'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BaseComponent } from '../../_core/base-component';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CmsBadge,
  CmsTable,
  CmsTableBody,
  CmsTableCell,
  CmsTableFooter,
  CmsTableHead,
  CmsTableHeader,
  CmsTableRow,
  CmsSection,
  CARD_TONES,
  themeClass,
  cmsBody,
  cmsHeading,
  dsSpacing,
} from '../../_ui';
import { resolveCmsIcon } from '../../_utils/icon-resolver';
import type {
  FeatureComparisonProps,
  FeatureComparisonContent,
  ComparisonValue,
  ComparisonProduct,
  ComparisonFeature,
} from './feature-comparison.types';

export type {
  FeatureComparisonProps,
  FeatureComparisonContent,
} from './feature-comparison.types';

const INCLUDED_LABEL = 'Included';
const NOT_INCLUDED_LABEL = 'Not included';
const RECOMMENDED_LABEL = 'Recommended';

function isTruthy(value: ComparisonValue): boolean {
  return value === true;
}

function isFalsy(value: ComparisonValue): boolean {
  return value === false;
}

class FeatureComparisonBase extends BaseComponent<FeatureComparisonProps> {
  private renderBooleanValue(value: boolean): React.ReactNode {
    const icon = resolveCmsIcon(value ? 'Check' : 'X', {
      className: cn(
        'size-5 transition-colors duration-200',
        value ? 'text-success' : 'text-destructive',
      ),
      fallback: value ? '✓' : '✕',
    });

    return (
      <span
        className={cn(
          'flex items-center justify-center',
        )}
        aria-label={value ? INCLUDED_LABEL : NOT_INCLUDED_LABEL}
        data-cms-value={value ? 'true' : 'false'}
      >
        {icon}
      </span>
    );
  }

  private renderValue(value: ComparisonValue): React.ReactNode {
    if (isTruthy(value) || isFalsy(value)) {
      return this.renderBooleanValue(Boolean(value));
    }

    if (typeof value === 'number' || typeof value === 'string') {
      return (
        <span
          className={cmsBody('sm', this.props.theme, 'font-medium text-foreground')}
          data-cms-value="text"
        >
          {value}
        </span>
      );
    }

    return (
      <span
        className={cmsBody('sm', this.props.theme)}
        data-cms-value="unknown"
      >
        {String(value ?? '')}
      </span>
    );
  }

  private renderProductHeader(product: ComparisonProduct, index: number): React.ReactNode {
    return (
      <CmsTableHead
        key={`product-${index}`}
        align="center"
        className="align-top"
        data-testid={`feature-comparison-product-${index}`}
      >
        <div
          className={cn(
            'flex flex-col items-center text-center',
            dsSpacing.gap('md'),
          )}
        >
          {product.recommended && (
            <CmsBadge variant="accent" theme={this.props.theme}>
              {RECOMMENDED_LABEL}
            </CmsBadge>
          )}
          <div
            className={cmsHeading(
              4,
              this.props.theme,
              'text-foreground',
            )}
          >
            {product.name}
          </div>
          {product.price && (
            <div
              className={cmsBody(
                'lg',
                this.props.theme,
                'font-semibold text-primary',
              )}
            >
              {product.price}
            </div>
          )}
        </div>
      </CmsTableHead>
    );
  }

  private renderFeatureRow(
    feature: ComparisonFeature,
    featureIndex: number,
  ): React.ReactNode {
    return (
      <CmsTableRow
        key={`feature-${featureIndex}`}
        data-testid={`feature-comparison-row-${featureIndex}`}
        className="group transition-colors duration-200 hover:bg-gradient-to-r hover:from-muted/30 hover:to-transparent"
      >
        <CmsTableCell align="left">
          <div className={cn('flex flex-col', dsSpacing.gap('xs'))}>
            <span
              className={cmsBody(
                'md',
                this.props.theme,
                'font-semibold text-foreground',
              )}
            >
              {feature.name}
            </span>
            {feature.description && (
              <span className={cmsBody('sm', this.props.theme)}>
                {feature.description}
              </span>
            )}
          </div>
        </CmsTableCell>
        {feature.values.map((value, valueIndex) => (
          <CmsTableCell
            key={`feature-${featureIndex}-value-${valueIndex}`}
            align="center"
            data-testid={`feature-comparison-value-${featureIndex}-${valueIndex}`}
          >
            {this.renderValue(value)}
          </CmsTableCell>
        ))}
      </CmsTableRow>
    );
  }

  private renderDesktopView(
    products: ComparisonProduct[],
    features: ComparisonFeature[],
  ): React.ReactNode {
    return (
      <div className="hidden w-full lg:block">
        <CmsTable
          theme={this.props.theme}
          variant={this.props.variant}
          responsive
          data-testid="feature-comparison-table"
          className="border border-border/40 shadow-md"
        >
          <CmsTableHeader sticky>
            <CmsTableRow className="bg-gradient-to-r from-card to-muted/30">
              <CmsTableHead align="left" className="text-left">
                <span
                  className={cmsBody(
                    'sm',
                    this.props.theme,
                    'font-semibold uppercase tracking-wide text-foreground',
                  )}
                >
                  Features
                </span>
              </CmsTableHead>
              {products.map((product, index) =>
                this.renderProductHeader(product, index),
              )}
            </CmsTableRow>
          </CmsTableHeader>

          <CmsTableBody>
            {features.map((feature, featureIndex) =>
              this.renderFeatureRow(feature, featureIndex),
            )}
          </CmsTableBody>

          <CmsTableFooter>
            <CmsTableRow>
              <CmsTableCell />
              {products.map((product, index) => (
                <CmsTableCell key={`cta-${index}`} align="center">
                  {product.cta?.href && product.cta.label ? (
                    <Button
                      asChild
                      variant="default"
                      size="sm"
                      onClick={() =>
                        this.handleInteraction(
                          'comparison-cta-click',
                          product.cta?.href,
                        )
                      }
                    >
                      <Link href={product.cta.href}>{product.cta.label}</Link>
                    </Button>
                  ) : null}
                </CmsTableCell>
              ))}
            </CmsTableRow>
          </CmsTableFooter>
        </CmsTable>
      </div>
    );
  }

  private renderMobileView(
    products: ComparisonProduct[],
    features: ComparisonFeature[],
  ): React.ReactNode {
    return (
      <div
        className={cn('flex w-full flex-col lg:hidden', dsSpacing.gap('xl'))}
        data-testid="feature-comparison-mobile"
      >
        {products.map((product, productIndex) => (
          <Card
            key={`mobile-product-${productIndex}`}
            className={cn(
              CARD_TONES['minimal'],
              themeClass(this.props.theme),
              'shadow-sm'
            )}
          >
            <CardHeader
              className={cn(
                'flex flex-col gap-2 p-[var(--component-padding)]',
                themeClass(this.props.theme),
                dsSpacing.gap('sm')
              )}
            >
              <div
                className={cn(
                  'flex items-start justify-between',
                  dsSpacing.gap('md'),
                )}
              >
                <div className={cn('flex flex-col', dsSpacing.gap('xs'))}>
                  <CardTitle className="text-left">
                    {product.name}
                  </CardTitle>
                  {product.price && (
                    <span
                      className={cmsBody(
                        'md',
                        this.props.theme,
                        'font-semibold text-primary',
                      )}
                    >
                      {product.price}
                    </span>
                  )}
                </div>
                {product.recommended && (
                  <CmsBadge variant="accent" theme={this.props.theme}>
                    {RECOMMENDED_LABEL}
                  </CmsBadge>
                )}
              </div>
            </CardHeader>

            <CardContent
              className={cn(
                'p-[var(--component-padding)] pt-0',
                themeClass(this.props.theme),
                'flex flex-col',
                dsSpacing.gap('lg')
              )}
            >
              {features.map((feature, featureIndex) => (
                <div
                  key={`mobile-feature-${featureIndex}`}
                  className={cn(
                    'flex items-start justify-between border-b border-border/40 last:border-0',
                    dsSpacing.gap('md'),
                    dsSpacing.pb('md'),
                    'last:pb-0',
                  )}
                >
                  <div className={cn('flex flex-col', dsSpacing.gap('xs'))}>
                    <span
                      className={cmsBody(
                        'sm',
                        this.props.theme,
                        'font-semibold text-foreground',
                      )}
                    >
                      {feature.name}
                    </span>
                    {feature.description && (
                      <span className={cmsBody('xs', this.props.theme)}>
                        {feature.description}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-center">
                    {this.renderValue(feature.values[productIndex])}
                  </div>
                </div>
              ))}
            </CardContent>

            {product.cta?.href && product.cta.label ? (
              <CardFooter
                className={cn(
                  'flex items-center gap-3 p-[var(--component-padding)] pt-0',
                  themeClass(this.props.theme)
                )}
              >
                <Button
                  asChild
                  variant="default"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    this.handleInteraction(
                      'comparison-cta-click',
                      product.cta?.href,
                    )
                  }
                >
                  <Link href={product.cta.href}>{product.cta.label}</Link>
                </Button>
              </CardFooter>
            ) : null}
          </Card>
        ))}
      </div>
    );
  }

  protected renderComponent(): React.ReactNode {
    const { heading, subheading, products, features } = this.props.content;

    return (
      <CmsSection
        size="md"
        theme={this.props.theme}
        variant={this.props.variant}
        className={cn('cms-feature-comparison', this.props.className)}
        containerClassName={dsSpacing.gap('3xl')}
        style={this.props.style}
        data-component-type={this.props.type}
        data-component-id={this.props.id}
        aria-label={this.props.ariaLabel || 'Feature comparison'}
      >
        {(heading || subheading) && (
          <div
            className={cn(
              'flex flex-col items-center text-center',
              dsSpacing.gap('lg'),
            )}
          >
            {heading ? (
              <h2 className={cmsHeading(2, this.props.theme)}>{heading}</h2>
            ) : null}
            {subheading ? (
              <p
                className={cmsBody(
                  'lg',
                  this.props.theme,
                  'max-w-3xl text-balance',
                )}
              >
                {subheading}
              </p>
            ) : null}
          </div>
        )}

        {this.renderDesktopView(products, features)}
        {this.renderMobileView(products, features)}
      </CmsSection>
    );
  }
}

const FeatureComparisonMemo = React.memo(FeatureComparisonBase);
export const FeatureComparison = withPerformanceTracking(
  FeatureComparisonMemo,
  ComponentType.PricingTable,
);
export default FeatureComparison;
