import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  CmsAlert,
  CmsAlertDescription,
  CmsAlertTitle,
  CmsBadge,
  CmsButtonGroup,
  CmsForm,
  CmsFormControl,
  CmsFormField,
  CmsFormItem,
  CmsFormLabel,
  CmsFormMessage,
  CmsFormRoot,
  cmsBody,
  CARD_TONES,
} from '.';
import { useForm } from 'react-hook-form';
import { cn } from '@/lib/utils';

const meta = {
  title: 'Studio/CMS/Design System/CmsWrappers',
  component: Button,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ButtonsAndBadges: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <CmsButtonGroup>
        <Button variant="default">Primary Action</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
      </CmsButtonGroup>
      <div className="flex gap-2">
        <CmsBadge variant="accent">Accent</CmsBadge>
        <CmsBadge variant="neutral">Neutral</CmsBadge>
        <CmsBadge variant="outline">Outline</CmsBadge>
      </div>
    </div>
  ),
};

export const CardWithAlert: Story = {
  render: () => (
    <Card className={cn(CARD_TONES.accent, "max-w-md")}>
      <CardHeader>
        <CardTitle className="theme-light text-lg">
          Stay informed
        </CardTitle>
      </CardHeader>
      <CardContent className={cmsBody('sm', 'light')}>
        Subscribe to receive monthly highlights from the Catalyst team.
      </CardContent>
      <CardFooter>
        <CmsAlert variant="success">
          <CmsAlertTitle>All systems go</CmsAlertTitle>
          <CmsAlertDescription>
            Wrapper tokens apply consistent backgrounds and text colors.
          </CmsAlertDescription>
        </CmsAlert>
      </CardFooter>
    </Card>
  ),
};

export const FormAndTabs: Story = {
  render: () => {
    const form = useForm<{ email: string }>({
      defaultValues: { email: '' },
    });

    return (
      <div className="flex flex-col gap-6">
        <Tabs defaultValue="form">
          <TabsList>
            <TabsTrigger value="form">Form</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <TabsContent value="form">
            <CmsForm {...form}>
              <CmsFormRoot className="space-y-4">
                <CmsFormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <CmsFormItem>
                      <CmsFormLabel>Email address</CmsFormLabel>
                      <CmsFormControl>
                        <Input {...field} type="email" placeholder="name@example.com" />
                      </CmsFormControl>
                      <CmsFormMessage />
                    </CmsFormItem>
                  )}
                />
                <Button type="submit" variant="default">
                  Submit
                </Button>
              </CmsFormRoot>
            </CmsForm>
          </TabsContent>
          <TabsContent value="details">
            <p className={cmsBody('sm')}>
              Wrappers forward refs, accept `className`, and provide theme-aware styling.
            </p>
          </TabsContent>
        </Tabs>
      </div>
    );
  },
};
