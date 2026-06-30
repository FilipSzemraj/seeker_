import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';

import type { Listing } from '../../../../core/models/listing.model';
import type { GeoArea } from '../../../../core/models/query.model';

/** Centre of Warszawa — used as the initial view before listings are fitted. */
const WARSAW: L.LatLngTuple = [52.2297, 21.0122];

/**
 * Leaflet map for the result set. Drops one pin per listing that has
 * coordinates, lets the user pick a marker (emitted up as the selected
 * `source_url`), and supports drawing a point + radius area that becomes a
 * geo hard-filter (`geoChange`). Map is created client-side only.
 */
@Component({
  selector: 'app-map-panel',
  templateUrl: './map-panel.html',
  styleUrl: './map-panel.scss',
})
export class MapPanel {
  readonly listings = input<Listing[]>([]);
  readonly selectedUrl = input<string | null>(null);
  readonly geo = input<GeoArea | null>(null);

  readonly select = output<string | null>();
  readonly geoChange = output<GeoArea | null>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('map');

  protected readonly picking = signal(false);
  protected readonly radiusKm = signal(2);

  private map?: L.Map;
  private readonly ready = signal(false);
  private readonly markers = new Map<string, L.Marker>();
  private areaCenter?: L.Marker;
  private areaCircle?: L.Circle;

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      const map = L.map(this.host().nativeElement, {
        center: WARSAW,
        zoom: 12,
        attributionControl: false,
        zoomControl: !isMobile,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);
      map.on('click', (e: L.LeafletMouseEvent) => this.onMapClick(e));

      // Keep Leaflet's canvas in sync when the layout splits to 2/3 width.
      const ro = new ResizeObserver(() => map.invalidateSize());
      ro.observe(this.host().nativeElement);

      this.map = map;
      this.ready.set(true);

      destroyRef.onDestroy(() => {
        ro.disconnect();
        map.remove();
      });
    });

    // Rebuild pins when the result set changes (re-fits the view).
    effect(() => {
      const listings = this.listings();
      if (!this.ready()) return;
      this.buildMarkers(listings);
      this.applySelection(untracked(() => this.selectedUrl()));
    });

    // React to selection alone — restyle + pan, without re-fitting bounds.
    effect(() => {
      const selected = this.selectedUrl();
      if (!this.ready()) return;
      this.applySelection(selected);
    });

    // Mirror the parent's geo area onto the map. Covers both the initial restore
    // and later external edits (e.g. lat/lon typed into the filter panel). Redraw
    // is idempotent, so changes the map itself emitted just settle harmlessly.
    effect(() => {
      const area = this.geo();
      if (!this.ready()) return;
      untracked(() => {
        if (area) {
          this.radiusKm.set(area.radius_km);
          this.drawArea(area.lat, area.lon, area.radius_km);
        } else {
          this.removeArea();
        }
      });
    });
  }

  private buildMarkers(listings: Listing[]): void {
    const map = this.map;
    if (!map) return;

    for (const marker of this.markers.values()) marker.remove();
    this.markers.clear();

    const points: L.LatLngTuple[] = [];
    for (const l of listings) {
      const { lat, lon } = l.geo;
      if (lat == null || lon == null) continue;
      const marker = L.marker([lat, lon], {
        icon: this.pinIcon(false),
        keyboard: true,
        title: l.title ?? 'Listing',
      });
      marker.on('click', () => this.select.emit(l.source_url));
      marker.addTo(map);
      this.markers.set(l.source_url, marker);
      points.push([lat, lon]);
    }

    if (points.length > 0 && !this.geo()) {
      map.fitBounds(L.latLngBounds(points).pad(0.2), { maxZoom: 14 });
    }
  }

  /** Restyle the selected pin and gently pan it into view. */
  private applySelection(selected: string | null): void {
    const map = this.map;
    if (!map) return;
    for (const [url, marker] of this.markers) {
      const isSelected = url === selected;
      marker.setIcon(this.pinIcon(isSelected));
      marker.setZIndexOffset(isSelected ? 1000 : 0);
    }
    if (selected) {
      const marker = this.markers.get(selected);
      if (marker) map.panTo(marker.getLatLng(), { animate: true });
    }
  }

  private pinIcon(selected: boolean): L.DivIcon {
    return L.divIcon({
      className: 'map-pin-wrap',
      html: `<span class="map-pin${selected ? ' is-selected' : ''}" aria-hidden="true"></span>`,
      iconSize: [22, 22],
      iconAnchor: [11, 22],
    });
  }

  // --- radius area picking --------------------------------------------------

  protected togglePicking(): void {
    this.picking.update((v) => !v);
  }

  protected onRadiusInput(raw: string): void {
    const km = Number(raw);
    this.radiusKm.set(km);
    const c = this.areaCenter?.getLatLng();
    if (c) {
      this.drawArea(c.lat, c.lng, km);
      this.emitArea(c.lat, c.lng, km);
    }
  }

  protected clearArea(): void {
    this.removeArea();
    this.geoChange.emit(null);
  }

  private removeArea(): void {
    this.areaCenter?.remove();
    this.areaCircle?.remove();
    this.areaCenter = undefined;
    this.areaCircle = undefined;
  }

  private onMapClick(e: L.LeafletMouseEvent): void {
    if (!this.picking()) return;
    const km = this.radiusKm();
    this.drawArea(e.latlng.lat, e.latlng.lng, km);
    this.emitArea(e.latlng.lat, e.latlng.lng, km);
  }

  private drawArea(lat: number, lon: number, km: number): void {
    const map = this.map;
    if (!map) return;
    const center: L.LatLngTuple = [lat, lon];
    const radiusM = km * 1000;

    if (this.areaCircle) this.areaCircle.setLatLng(center).setRadius(radiusM);
    else this.areaCircle = L.circle(center, { radius: radiusM, className: 'map-area' }).addTo(map);

    // Bring the point into view when it lands off-screen (e.g. typed coords);
    // edits made within the current view (clicks, drags) leave the map put.
    if (!map.getBounds().contains(center)) map.panTo(center, { animate: true });

    if (this.areaCenter) {
      this.areaCenter.setLatLng(center);
    } else {
      this.areaCenter = L.marker(center, {
        draggable: true,
        icon: L.divIcon({
          className: 'map-pin-wrap',
          html: '<span class="map-pin is-area" aria-hidden="true"></span>',
          iconSize: [22, 22],
          iconAnchor: [11, 22],
        }),
        title: 'Drag to move the area',
      }).addTo(map);
      this.areaCenter.on('drag', () => {
        const c = this.areaCenter!.getLatLng();
        this.areaCircle?.setLatLng(c);
      });
      this.areaCenter.on('dragend', () => {
        const c = this.areaCenter!.getLatLng();
        this.emitArea(c.lat, c.lng, this.radiusKm());
      });
    }
  }

  private emitArea(lat: number, lon: number, km: number): void {
    this.geoChange.emit({ lat, lon, radius_km: km });
  }
}
