/**
 * Mostra os textos da ONG escritos no painel em Markdown simples:
 * # / ## / ### títulos, - ou * itens, 1. itens numerados, **negrito**, [texto](https://link)
 * e e-mails soltos (viram link). Sem bibliotecas: só o que os textos usam.
 */
import React from 'react';
import {Linking, StyleSheet, Text, View} from 'react-native';
import {F} from '../theme/home';

export function parseMarkdown(md) {
  const blocks = [];
  let para = [];
  const flush = () => {
    if (para.length) blocks.push({type: 'p', text: para.join(' ')});
    para = [];
  };
  String(md || '')
    .split(/\r?\n/)
    .forEach(raw => {
      const line = raw.trim();
      let m;
      if (!line) {
        flush();
      } else if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
        flush();
        blocks.push({type: m[1].length === 1 ? 'h1' : m[1].length === 2 ? 'h2' : 'h3', text: m[2]});
      } else if ((m = line.match(/^[-*]\s+(.*)$/))) {
        flush();
        blocks.push({type: 'li', text: m[1]});
      } else if ((m = line.match(/^(\d+)[.)]\s+(.*)$/))) {
        flush();
        blocks.push({type: 'oli', n: m[1], text: m[2]});
      } else {
        para.push(line);
      }
    });
  flush();
  return blocks;
}

/** Pedaços de uma linha: texto, negrito e links. */
export function parseInline(text) {
  const parts = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)|([\w.+-]+@[\w-]+\.[\w.-]+)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({t: text.slice(last, m.index)});
    if (m[1]) parts.push({t: m[1], bold: true});
    else if (m[2]) parts.push({t: m[2], url: m[3]});
    else parts.push({t: m[4], url: `mailto:${m[4].replace(/[.,;]$/, '')}`});
    last = re.lastIndex;
  }
  if (last < text.length) parts.push({t: text.slice(last)});
  return parts;
}

function Inline({text, style, color}) {
  return (
    <Text style={style}>
      {parseInline(text).map((p, i) =>
        p.url ? (
          <Text key={i} style={[styles.link, color ? {color} : null]} onPress={() => Linking.openURL(p.url).catch(() => {})}>
            {p.t}
          </Text>
        ) : (
          <Text key={i} style={p.bold ? styles.bold : null}>
            {p.t}
          </Text>
        ),
      )}
    </Text>
  );
}

export default function MarkdownText({source, color, skipFirstHeading = false, testID}) {
  let blocks = parseMarkdown(source);
  if (skipFirstHeading && blocks[0]?.type === 'h1') blocks = blocks.slice(1);
  return (
    <View testID={testID}>
      {blocks.map((b, i) => {
        if (b.type === 'h1') return <Inline key={i} text={b.text} style={styles.h1} />;
        if (b.type === 'h2') return <Inline key={i} text={b.text} style={styles.h2} />;
        if (b.type === 'h3') return <Inline key={i} text={b.text} style={styles.h3} />;
        if (b.type === 'li' || b.type === 'oli')
          return (
            <View key={i} style={styles.row}>
              <Text style={[styles.bullet, color ? {color} : null]}>{b.type === 'li' ? '•' : `${b.n}.`}</Text>
              <Inline text={b.text} style={[styles.p, styles.itemText]} color={color} />
            </View>
          );
        return <Inline key={i} text={b.text} style={styles.p} color={color} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  h1: {...F.bold, fontSize: 20, color: '#1F2937', marginBottom: 10},
  h2: {...F.bold, fontSize: 17, color: '#1F2937', marginTop: 14, marginBottom: 6},
  h3: {...F.semibold, fontSize: 15, color: '#1F2937', marginTop: 10, marginBottom: 4},
  p: {...F.regular, fontSize: 14, color: '#4B5563', lineHeight: 22, marginBottom: 10},
  row: {flexDirection: 'row', alignItems: 'flex-start', paddingRight: 8},
  bullet: {...F.bold, fontSize: 14, color: '#5B21B6', width: 22, lineHeight: 22},
  itemText: {flex: 1, marginBottom: 6},
  bold: {...F.bold, color: '#1F2937'},
  link: {...F.semibold, color: '#5B21B6', textDecorationLine: 'underline'},
});
