import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface GeoDataPoint {
  country: string;
  countryCode: string;
  region: 'LATAM' | 'EU' | 'APAC' | 'NA' | 'MENA' | 'OTHER';
  quotes: number;
  conversions: number;
  revenue: number;
  lat?: number;
  lng?: number;
}

@Component({
  selector: 'app-geo-heatmap',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-full relative bg-bitcoin-dark/20 rounded-xl overflow-hidden">
      <!-- World Map SVG -->
      <svg viewBox="0 0 1000 500" class="w-full h-full">
        <!-- Background -->
        <rect x="0" y="0" width="1000" height="500" fill="#0a0b0d" />
        
        <!-- Simplified world map paths -->
        <g class="continents" opacity="0.2">
          <!-- North America -->
          <path d="M 100 80 L 180 60 L 250 100 L 280 180 L 200 200 L 150 160 Z" 
                fill="#666" stroke="#888" stroke-width="0.5"/>
          
          <!-- South America -->
          <path d="M 220 250 L 260 240 L 280 300 L 260 380 L 220 360 L 200 300 Z" 
                fill="#666" stroke="#888" stroke-width="0.5"/>
          
          <!-- Europe -->
          <path d="M 450 80 L 520 70 L 540 120 L 520 140 L 470 130 Z" 
                fill="#666" stroke="#888" stroke-width="0.5"/>
          
          <!-- Africa -->
          <path d="M 480 180 L 550 170 L 560 280 L 520 320 L 480 300 Z" 
                fill="#666" stroke="#888" stroke-width="0.5"/>
          
          <!-- Asia -->
          <path d="M 600 80 L 750 70 L 820 140 L 800 200 L 720 180 L 650 140 Z" 
                fill="#666" stroke="#888" stroke-width="0.5"/>
          
          <!-- Oceania -->
          <path d="M 800 300 L 880 290 L 900 340 L 860 360 Z" 
                fill="#666" stroke="#888" stroke-width="0.5"/>
        </g>

        <!-- Region Labels -->
        <g class="region-labels">
          <text x="200" y="140" class="text-xs fill-white/40" text-anchor="middle" font-family="system-ui">North America</text>
          <text x="240" y="310" class="text-xs fill-white/40" text-anchor="middle" font-family="system-ui">LATAM</text>
          <text x="490" y="110" class="text-xs fill-white/40" text-anchor="middle" font-family="system-ui">Europe</text>
          <text x="700" y="130" class="text-xs fill-white/40" text-anchor="middle" font-family="system-ui">Asia Pacific</text>
        </g>

        <!-- Data points -->
        @for (point of geoData; track point.countryCode) {
          <g class="data-point cursor-pointer" 
             (mouseenter)="showTooltip(point, $event)"
             (mouseleave)="hideTooltip()">
            <!-- Outer glow -->
            <circle
              [attr.cx]="getX(point)"
              [attr.cy]="getY(point)"
              [attr.r]="getRadius(point) + 8"
              [attr.fill]="getRegionColor(point.region)"
              opacity="0.2"
              class="transition-all hover:opacity-40" />
            
            <!-- Main circle -->
            <circle
              [attr.cx]="getX(point)"
              [attr.cy]="getY(point)"
              [attr.r]="getRadius(point)"
              [attr.fill]="getRegionColor(point.region)"
              opacity="0.8"
              class="transition-all hover:opacity-100" />
            
            <!-- Pulse animation for high activity -->
            @if (point.quotes > 50) {
              <circle
                [attr.cx]="getX(point)"
                [attr.cy]="getY(point)"
                [attr.r]="getRadius(point)"
                [attr.stroke]="getRegionColor(point.region)"
                stroke-width="2"
                fill="none"
                opacity="0">
                <animate attributeName="r" 
                         [attr.from]="getRadius(point)" 
                         [attr.to]="getRadius(point) + 15" 
                         dur="2s" 
                         repeatCount="indefinite"/>
                <animate attributeName="opacity" 
                         from="0.8" 
                         to="0" 
                         dur="2s" 
                         repeatCount="indefinite"/>
              </circle>
            }
          </g>
        }
      </svg>

      <!-- Tooltip -->
      @if (tooltip.visible) {
        <div
          class="absolute bg-bitcoin-dark/95 border border-bitcoin-orange/30 rounded-lg px-4 py-3 pointer-events-none shadow-xl backdrop-blur-sm z-10"
          [style.left.px]="tooltip.x"
          [style.top.px]="tooltip.y">
          <div class="text-sm font-bold text-white mb-2">{{ tooltip.country }}</div>
          <div class="space-y-1 text-xs">
            <div class="flex justify-between gap-4">
              <span class="text-white/60">Region:</span>
              <span class="font-semibold" [style.color]="getRegionColor(tooltip.region)">{{ tooltip.region }}</span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-white/60">Quote Requests:</span>
              <span class="text-white font-semibold">{{ tooltip.quotes }}</span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-white/60">Conversions:</span>
              <span class="text-bitcoin-gold font-semibold">{{ tooltip.conversions }}</span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-white/60">Conversion Rate:</span>
              <span 
                class="font-semibold"
                [class.text-green-400]="tooltip.conversionRate >= 15"
                [class.text-bitcoin-gold]="tooltip.conversionRate >= 10 && tooltip.conversionRate < 15"
                [class.text-red-400]="tooltip.conversionRate < 10">
                {{ tooltip.conversionRate }}%
              </span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-white/60">Revenue:</span>
              <span class="text-bitcoin-orange font-semibold">{{ tooltip.revenue | number:'1.0-0' }}</span>
            </div>
          </div>
        </div>
      }

      <!-- Legend -->
      <div class="absolute bottom-4 left-4 bg-bitcoin-dark/90 border border-bitcoin-gray/20 rounded-lg p-3 backdrop-blur-sm">
        <div class="text-xs font-semibold text-white/80 mb-2">Regions</div>
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-[#F7931A]"></div>
            <span class="text-xs text-white/70">LATAM</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-[#4A90E2]"></div>
            <span class="text-xs text-white/70">Europe</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-[#50C878]"></div>
            <span class="text-xs text-white/70">APAC</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-[#9B59B6]"></div>
            <span class="text-xs text-white/70">North America</span>
          </div>
        </div>
        <div class="mt-3 pt-2 border-t border-bitcoin-gray/20">
          <div class="text-xs text-white/60">Circle size = Quote volume</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `]
})
export class GeoHeatmapComponent implements OnChanges {
  @Input() geoData: GeoDataPoint[] = [];

  tooltip = {
    visible: false,
    x: 0,
    y: 0,
    country: '',
    region: 'OTHER' as GeoDataPoint['region'],
    quotes: 0,
    conversions: 0,
    conversionRate: 0,
    revenue: 0
  };

  // Approximate coordinates for countries (simplified)
  private countryCoordinates: Record<string, { x: number; y: number }> = {
    // LATAM
    'BR': { x: 250, y: 310 }, // Brazil
    'MX': { x: 180, y: 200 }, // Mexico
    'AR': { x: 240, y: 370 }, // Argentina
    'CL': { x: 220, y: 380 }, // Chile
    'CO': { x: 220, y: 270 }, // Colombia
    'PE': { x: 210, y: 300 }, // Peru
    
    // Europe
    'GB': { x: 470, y: 100 }, // UK
    'DE': { x: 500, y: 105 }, // Germany
    'FR': { x: 480, y: 115 }, // France
    'ES': { x: 470, y: 130 }, // Spain
    'IT': { x: 510, y: 125 }, // Italy
    'NL': { x: 490, y: 100 }, // Netherlands
    'SE': { x: 510, y: 85 },  // Sweden
    'NO': { x: 500, y: 80 },  // Norway
    'PL': { x: 520, y: 100 }, // Poland
    
    // APAC
    'CN': { x: 720, y: 140 }, // China
    'JP': { x: 800, y: 140 }, // Japan
    'KR': { x: 780, y: 145 }, // South Korea
    'IN': { x: 660, y: 180 }, // India
    'AU': { x: 840, y: 340 }, // Australia
    'SG': { x: 720, y: 250 }, // Singapore
    'TH': { x: 700, y: 210 }, // Thailand
    'VN': { x: 710, y: 210 }, // Vietnam
    'ID': { x: 740, y: 270 }, // Indonesia
    'MY': { x: 720, y: 240 }, // Malaysia
    'PH': { x: 760, y: 210 }, // Philippines
    
    // North America
    'US': { x: 200, y: 140 }, // USA
    'CA': { x: 180, y: 90 },  // Canada
    
    // MENA
    'AE': { x: 600, y: 180 }, // UAE
    'SA': { x: 580, y: 200 }, // Saudi Arabia
    'IL': { x: 540, y: 165 }, // Israel
    'TR': { x: 540, y: 135 }, // Turkey
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['geoData']) {
      // Auto-assign coordinates if not provided
      this.geoData = this.geoData.map(point => ({
        ...point,
        lat: point.lat ?? this.countryCoordinates[point.countryCode]?.y ?? 250,
        lng: point.lng ?? this.countryCoordinates[point.countryCode]?.x ?? 500
      }));
    }
  }

  getX(point: GeoDataPoint): number {
    return this.countryCoordinates[point.countryCode]?.x ?? 500;
  }

  getY(point: GeoDataPoint): number {
    return this.countryCoordinates[point.countryCode]?.y ?? 250;
  }

  getRadius(point: GeoDataPoint): number {
    // Scale based on quote volume (min 5, max 30)
    const minRadius = 5;
    const maxRadius = 30;
    const maxQuotes = Math.max(...this.geoData.map(p => p.quotes), 100);
    const normalized = point.quotes / maxQuotes;
    return minRadius + (normalized * (maxRadius - minRadius));
  }

  getRegionColor(region: GeoDataPoint['region']): string {
    const colors = {
      'LATAM': '#F7931A', // bitcoin-orange
      'EU': '#4A90E2',    // blue
      'APAC': '#50C878',  // green
      'NA': '#9B59B6',    // purple
      'MENA': '#E74C3C',  // red
      'OTHER': '#95A5A6'  // gray
    };
    return colors[region] || colors.OTHER;
  }

  showTooltip(point: GeoDataPoint, event: MouseEvent): void {
    const target = event.target as SVGElement;
    const svg = target.closest('svg');
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const conversionRate = point.quotes > 0 ? (point.conversions / point.quotes) * 100 : 0;

    this.tooltip = {
      visible: true,
      x: this.getX(point) - 100,
      y: this.getY(point) - 140,
      country: point.country,
      region: point.region,
      quotes: point.quotes,
      conversions: point.conversions,
      conversionRate: Math.round(conversionRate * 10) / 10,
      revenue: point.revenue
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }
}
