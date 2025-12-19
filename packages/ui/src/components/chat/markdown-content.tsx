import React from 'react';
import { View, Text, Platform } from 'react-native';

export interface MarkdownContentProps {
  content: string;
  className?: string;
}

interface ParsedToken {
  type: 'text' | 'bold' | 'italic' | 'code' | 'code_block' | 'link' | 'heading' | 'list_item';
  content: string;
  language?: string;
  level?: number;
}

function parseMarkdown(text: string): ParsedToken[] {
  const tokens: ParsedToken[] = [];
  const lines = text.split('\n');
  let inCodeBlock = false;
  let codeBlockContent = '';
  let codeBlockLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line?.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line?.slice(3).trim();
        codeBlockContent = '';
      } else {
        inCodeBlock = false;
        tokens.push({ type: 'code_block', content: codeBlockContent.trim(), language: codeBlockLang });
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += (codeBlockContent ? '\n' : '') + line;
      continue;
    }

    if (line?.startsWith('### ')) {
      tokens.push({ type: 'heading', content: line?.slice(4), level: 3 });
    } else if (line?.startsWith('## ')) {
      tokens.push({ type: 'heading', content: line?.slice(3), level: 2 });
    } else if (line?.startsWith('# ')) {
      tokens.push({ type: 'heading', content: line?.slice(2), level: 1 });
    } else if (line?.match(/^[\*\-]\s/)) {
      tokens.push({ type: 'list_item', content: line?.slice(2) });
    } else if (line?.trim()) {
      tokens.push({ type: 'text', content: line });
    }
  }

  return tokens;
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  const patterns = [
    { regex: /\*\*([^*]+)\*\*/g, type: 'bold' },
    { regex: /\*([^*]+)\*/g, type: 'italic' },
    { regex: /`([^`]+)`/g, type: 'code' },
  ];

  while (remaining) {
    let earliestMatch: { index: number; match: RegExpMatchArray; type: string } | null = null;

    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      const match = pattern.regex.exec(remaining);
      if (match && (!earliestMatch || match.index < earliestMatch.index)) {
        earliestMatch = { index: match.index, match, type: pattern.type };
      }
    }

    if (!earliestMatch) {
      if (remaining) parts.push(<Text key={key++}>{remaining}</Text>);
      break;
    }

    if (earliestMatch.index > 0) {
      parts.push(<Text key={key++}>{remaining.slice(0, earliestMatch.index)}</Text>);
    }

    const content = earliestMatch.match[1];
    if (earliestMatch.type === 'bold') {
      parts.push(<Text key={key++} className="font-bold">{content}</Text>);
    } else if (earliestMatch.type === 'italic') {
      parts.push(<Text key={key++} className="italic">{content}</Text>);
    } else if (earliestMatch.type === 'code') {
      parts.push(
        <Text 
          key={key++} 
          className="bg-gray-200 dark:bg-gray-700 text-red-600 dark:text-red-400 px-1 rounded"
          style={{ fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) }}
        >
          {content}
        </Text>
      );
    }

    remaining = remaining.slice(earliestMatch.index + earliestMatch.match[0].length);
  }

  return parts;
}

function TokenRenderer({ token }: { token: ParsedToken }) {
  switch (token.type) {
    case 'heading':
      const headingStyles = {
        1: 'text-2xl font-bold mb-2',
        2: 'text-xl font-bold mb-2',
        3: 'text-lg font-semibold mb-1',
      };
      return (
        <Text className={`text-gray-900 dark:text-white ${headingStyles[token.level as 1 | 2 | 3] || ''}`}>
          {renderInlineFormatting(token.content)}
        </Text>
      );

    case 'code_block':
      return (
        <View className="bg-gray-900 rounded-lg p-3 my-2 overflow-hidden">
          {token.language && (
            <Text className="text-xs text-gray-400 mb-2">{token.language}</Text>
          )}
          <Text 
            className="text-sm text-gray-100"
            style={{ fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) }}
          >
            {token.content}
          </Text>
        </View>
      );

    case 'list_item':
      return (
        <View className="flex-row mb-1">
          <Text className="text-gray-900 dark:text-white mr-2">•</Text>
          <Text className="text-gray-900 dark:text-white flex-1">
            {renderInlineFormatting(token.content)}
          </Text>
        </View>
      );

    case 'text':
    default:
      return (
        <Text className="text-base leading-6 text-gray-900 dark:text-white mb-2">
          {renderInlineFormatting(token.content)}
        </Text>
      );
  }
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  const tokens = parseMarkdown(content);

  return (
    <View className={className}>
      {tokens.map((token, i) => (
        <TokenRenderer key={i} token={token} />
      ))}
    </View>
  );
}
