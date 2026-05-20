import type { Meta, StoryObj } from '@storybook/react';
import DataTable from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

const meta = {
  title: 'Studio/CMS/Data/DataTable',
  component: DataTable,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: 'datatable-1',
    type: ComponentType.DataTable,
    category: ComponentCategory.Data,
    content: {
      title: 'Quarterly Sales',
      subtitle: 'Performance overview for the latest quarter',
      columns: [
        { key: 'product', label: 'Product', sortable: true },
        { key: 'category', label: 'Category', sortable: true },
        { key: 'sales', label: 'Sales', sortable: true, align: 'right' },
        { key: 'revenue', label: 'Revenue', sortable: true, align: 'right' },
        { key: 'status', label: 'Status', sortable: false, align: 'center' }
      ],
      rows: [
        { id: 'row-1', product: 'Aurora Lamp', category: 'Lighting', sales: 180, revenue: '$12,600', status: 'Active' },
        { id: 'row-2', product: 'Horizon Desk', category: 'Furniture', sales: 120, revenue: '$24,800', status: 'Active' },
        { id: 'row-3', product: 'Pulse Monitor', category: 'Health', sales: 90, revenue: '$7,200', status: 'Paused' },
        { id: 'row-4', product: 'Solstice Chair', category: 'Furniture', sales: 140, revenue: '$18,400', status: 'Active' },
        { id: 'row-5', product: 'Nimbus Speaker', category: 'Audio', sales: 75, revenue: '$9,000', status: 'Active' },
      ],
      pagination: {
        enabled: true,
        pageSize: 3,
        pageSizeOptions: [3, 5, 10],
      },
      sorting: {
        enabled: true,
        defaultSort: { key: 'sales', order: 'desc' },
      },
      filtering: {
        enabled: true,
        placeholder: 'Search products...',
      },
      striped: true,
      bordered: true,
      hoverable: true,
      responsive: true,
    }
  }
};
