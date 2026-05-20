import { CMSComponentProps } from '../../_core/types';

export type ChartType = 'bar' | 'line' | 'donut';

export type ChartTone = 'accent' | 'positive' | 'negative' | 'neutral';

export interface ChartDatum {
  id?: string;
  label?: string;
  value?: number | string;
  tone?: ChartTone;
}

export interface ChartSeries {
  id?: string;
  name?: string;
  values?: Array<number | string>;
  tone?: ChartTone;
  icon?: string;
}

export interface ChartContent {
  title?: string;
  description?: string;
  type?: ChartType;
  categories?: Array<string>;
  data?: ChartDatum[];
  series?: ChartSeries[];
  unitLabel?: string;
  footnote?: string;
}

export interface ChartProps extends CMSComponentProps {
  content: ChartContent;
}
