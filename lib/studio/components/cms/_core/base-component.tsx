import React, { Component, ErrorInfo, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { themeClass } from '../_ui/classnames';
import { CMSComponentProps } from './types';

interface BaseComponentState {
  hasError: boolean;
  error?: Error;
}

export abstract class BaseComponent<P extends CMSComponentProps = CMSComponentProps> 
  extends Component<P, BaseComponentState> {
  
  constructor(props: P) {
    super(props);
    this.state = {
      hasError: false
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
    console.error('Component Error:', {
      component: this.props.type,
      id: this.props.id,
      error,
      errorInfo
    });
    }
    
    this.setState({
      hasError: true,
      error
    });
    
    if (this.props.onError) {
      this.props.onError(error);
    }
  }
  
  componentDidMount() {
    if (this.props.onLoad) {
      this.props.onLoad();
    }
  }
  
  protected getThemeClass(): string | undefined {
    return themeClass(this.props.theme);
  }

  protected getCombinedClassName(...classes: (string | undefined)[]): string {
    return cn(
      this.getThemeClass(),
      ...classes,
      this.props.className
    );
  }
  
  protected handleInteraction(event: string, data?: any) {
    if (this.props.onInteraction) {
      this.props.onInteraction(event, data);
    }
  }

  protected renderErrorFallback(): ReactNode {
    const { type, id } = this.props;
    const { error } = this.state;
    const showDiagnostics = process.env.NODE_ENV !== 'production' && error;

    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'cms-component-error rounded-md border border-border/60',
          'bg-muted/70 p-4 text-sm text-muted-foreground',
        )}
        data-component-type={type}
        data-component-id={id}
      >
        <p className="font-semibold text-foreground">
          We couldn&apos;t render this block.
        </p>
        <p className="mt-1">
          Try reloading the page or contact support if the problem continues.
        </p>
        {showDiagnostics ? (
          <details className="mt-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer text-muted-foreground">
              Error details
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-background p-3 font-mono text-[11px] text-destructive">
              {(error?.stack || error?.message || String(error)).trim()}
            </pre>
          </details>
        ) : null}
      </div>
    );
  }
  
  render(): ReactNode {
    if (this.state.hasError) {
      return this.renderErrorFallback();
    }
    
    return this.renderComponent();
  }
  
  protected abstract renderComponent(): ReactNode;
}

export const withBaseComponent = <P extends CMSComponentProps>(
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<P> => {
  return class extends BaseComponent<P> {
    protected renderComponent(): ReactNode {
      return <WrappedComponent {...this.props} />;
    }
  };
};
