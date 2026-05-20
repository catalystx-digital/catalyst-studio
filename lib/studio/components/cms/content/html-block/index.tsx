import React from 'react';
import { HtmlBlockServer } from './html-block.server';
import { HtmlBlockClient } from './html-block.client';
import type { HtmlBlockProps } from './html-block.types';

const HtmlBlock: React.FC<HtmlBlockProps> = React.memo((props) => {
  return (
    <>
      <HtmlBlockServer {...props} />
      <HtmlBlockClient id={props.id} onInteraction={props.onInteraction} />
    </>
  );
});

HtmlBlock.displayName = 'HtmlBlock';

export default HtmlBlock;
export { HtmlBlock };
