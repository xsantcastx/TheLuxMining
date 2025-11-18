import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ChartDataPoint {
  label: string;
  value: number;
  date?: Date;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color: string;
}

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-full relative">
      <!-- Chart -->
      <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" class="w-full h-full">
        <!-- Grid lines -->
        <g class="grid-lines" opacity="0.1">
          @for (line of gridLines; track $index) {
            <line
              [attr.x1]="padding.left"
              [attr.y1]="line.y"
              [attr.x2]="width - padding.right"
              [attr.y2]="line.y"
              stroke="currentColor"
              stroke-width="1"
              class="text-white" />
          }
        </g>

        <!-- X-axis labels -->
        <g class="x-axis-labels">
          @for (point of displayPoints; track $index) {
            @if ($index % labelSkip === 0 || $index === displayPoints.length - 1) {
              <text
                [attr.x]="point.x"
                [attr.y]="height - padding.bottom + 20"
                text-anchor="middle"
                class="text-[10px] fill-white/60"
                font-family="system-ui">
                {{ point.label }}
              </text>
            }
          }
        </g>

        <!-- Y-axis labels -->
        <g class="y-axis-labels">
          @for (line of gridLines; track $index) {
            <text
              [attr.x]="padding.left - 10"
              [attr.y]="line.y + 4"
              text-anchor="end"
              class="text-[10px] fill-white/60"
              font-family="system-ui">
              {{ line.label }}
            </text>
          }
        </g>

        <!-- Chart lines -->
        @for (series of series; track series.name) {
          <path
            [attr.d]="getLinePath(series)"
            fill="none"
            [attr.stroke]="series.color"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round" />
          
          <!-- Data points -->
          @for (point of getSeriesPoints(series); track $index) {
            <circle
              [attr.cx]="point.x"
              [attr.cy]="point.y"
              r="4"
              [attr.fill]="series.color"
              class="cursor-pointer hover:r-6 transition-all"
              (mouseenter)="showTooltip(point, series, $event)"
              (mouseleave)="hideTooltip()" />
          }
        }
      </svg>

      <!-- Tooltip -->
      @if (tooltip.visible) {
        <div
          class="absolute bg-bitcoin-dark/95 border border-bitcoin-orange/30 rounded-lg px-3 py-2 pointer-events-none shadow-lg backdrop-blur-sm"
          [style.left.px]="tooltip.x"
          [style.top.px]="tooltip.y">
          <div class="text-xs font-semibold text-white mb-1">{{ tooltip.label }}</div>
          <div class="text-sm font-bold" [style.color]="tooltip.color">
            {{ tooltip.value }}
          </div>
        </div>
      }

      <!-- Legend -->
      @if (showLegend && series.length > 1) {
        <div class="absolute top-0 right-0 flex gap-4">
          @for (s of series; track s.name) {
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full" [style.background-color]="s.color"></div>
              <span class="text-xs text-white/80">{{ s.name }}</span>
            </div>
          }
        </div>
      }
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
export class LineChartComponent implements OnChanges {
  @Input() series: ChartSeries[] = [];
  @Input() width = 800;
  @Input() height = 400;
  @Input() showLegend = true;
  @Input() valuePrefix = '';
  @Input() valueSuffix = '';

  padding = { top: 20, right: 20, bottom: 40, left: 60 };
  gridLines: { y: number; label: string }[] = [];
  displayPoints: { x: number; label: string }[] = [];
  labelSkip = 1;

  tooltip = {
    visible: false,
    x: 0,
    y: 0,
    label: '',
    value: '',
    color: ''
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['series'] && this.series.length > 0) {
      this.calculateChart();
    }
  }

  private calculateChart(): void {
    const allValues = this.series.flatMap(s => s.data.map(d => d.value));
    const maxValue = Math.max(...allValues, 0);
    const minValue = Math.min(...allValues, 0);
    
    // Calculate nice Y-axis values
    const range = maxValue - minValue;
    const step = this.getNiceStep(range / 5);
    const yMax = Math.ceil(maxValue / step) * step;
    const yMin = Math.floor(minValue / step) * step;

    // Generate grid lines
    this.gridLines = [];
    for (let value = yMin; value <= yMax; value += step) {
      const y = this.valueToY(value, yMin, yMax);
      this.gridLines.push({
        y,
        label: this.formatValue(value)
      });
    }

    // Calculate X positions for labels
    const firstSeries = this.series[0];
    if (firstSeries && firstSeries.data.length > 0) {
      this.displayPoints = firstSeries.data.map((point, index) => ({
        x: this.indexToX(index, firstSeries.data.length),
        label: point.label
      }));

      // Skip labels if too many
      this.labelSkip = firstSeries.data.length > 12 ? Math.ceil(firstSeries.data.length / 8) : 1;
    }
  }

  getLinePath(series: ChartSeries): string {
    if (series.data.length === 0) return '';

    const allValues = this.series.flatMap(s => s.data.map(d => d.value));
    const maxValue = Math.max(...allValues, 0);
    const minValue = Math.min(...allValues, 0);
    const range = maxValue - minValue;
    const step = this.getNiceStep(range / 5);
    const yMax = Math.ceil(maxValue / step) * step;
    const yMin = Math.floor(minValue / step) * step;

    const points = series.data.map((point, index) => {
      const x = this.indexToX(index, series.data.length);
      const y = this.valueToY(point.value, yMin, yMax);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  }

  getSeriesPoints(series: ChartSeries): { x: number; y: number; value: number; label: string }[] {
    const allValues = this.series.flatMap(s => s.data.map(d => d.value));
    const maxValue = Math.max(...allValues, 0);
    const minValue = Math.min(...allValues, 0);
    const range = maxValue - minValue;
    const step = this.getNiceStep(range / 5);
    const yMax = Math.ceil(maxValue / step) * step;
    const yMin = Math.floor(minValue / step) * step;

    return series.data.map((point, index) => ({
      x: this.indexToX(index, series.data.length),
      y: this.valueToY(point.value, yMin, yMax),
      value: point.value,
      label: point.label
    }));
  }

  private indexToX(index: number, total: number): number {
    const chartWidth = this.width - this.padding.left - this.padding.right;
    return this.padding.left + (index / (total - 1 || 1)) * chartWidth;
  }

  private valueToY(value: number, min: number, max: number): number {
    const chartHeight = this.height - this.padding.top - this.padding.bottom;
    const range = max - min || 1;
    const normalized = (value - min) / range;
    return this.height - this.padding.bottom - normalized * chartHeight;
  }

  private getNiceStep(roughStep: number): number {
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalized = roughStep / magnitude;
    
    if (normalized < 1.5) return magnitude;
    if (normalized < 3) return 2 * magnitude;
    if (normalized < 7) return 5 * magnitude;
    return 10 * magnitude;
  }

  private formatValue(value: number): string {
    if (Math.abs(value) >= 1000000) {
      return this.valuePrefix + (value / 1000000).toFixed(1) + 'M' + this.valueSuffix;
    }
    if (Math.abs(value) >= 1000) {
      return this.valuePrefix + (value / 1000).toFixed(1) + 'K' + this.valueSuffix;
    }
    return this.valuePrefix + value.toFixed(0) + this.valueSuffix;
  }

  showTooltip(point: any, series: ChartSeries, event: MouseEvent): void {
    const target = event.target as SVGElement;
    const svg = target.closest('svg');
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    this.tooltip = {
      visible: true,
      x: point.x - this.padding.left + 10,
      y: point.y - 50,
      label: point.label,
      value: this.valuePrefix + point.value.toLocaleString() + this.valueSuffix,
      color: series.color
    };
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
  }
}
