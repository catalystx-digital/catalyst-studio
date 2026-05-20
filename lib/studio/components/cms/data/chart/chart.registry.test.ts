import '../register';
import { cmsComponentFactory } from '../../_factory/factory';
import { ComponentType } from '../../_core/types';

describe('CMS chart registration', () => {
  it('registers the chart adapter with the factory', () => {
    const component = cmsComponentFactory.getComponent(ComponentType.Chart);
    expect(component).toBeTruthy();
    expect(typeof component).toBe('function');
  });
});
