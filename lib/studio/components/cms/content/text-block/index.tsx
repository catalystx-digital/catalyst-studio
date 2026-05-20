import React from 'react';
import { TextBlockServer } from './text-block.server';
import { TextBlockClient } from './text-block.client';
import type { TextBlockProps } from './text-block.types';

const TextBlock: React.FC<TextBlockProps> = React.memo((props) => {
  return (
    <>
      <TextBlockServer {...props} />
      <TextBlockClient id={props.id} onInteraction={props.onInteraction} />
    </>
  );
});

TextBlock.displayName = 'TextBlock';

export default TextBlock;
export { TextBlock };
