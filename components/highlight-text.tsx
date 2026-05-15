import { Text, type TextStyle, type StyleProp } from "react-native";
import React from "react";

interface HighlightTextProps {
  text: string;
  highlight: string;
  style?: StyleProp<TextStyle>;
  highlightStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/**
 * Renders text with matching portions highlighted (bold + primary color).
 * If no highlight or no match, renders the text normally.
 */
export function HighlightText({
  text,
  highlight,
  style,
  highlightStyle,
  numberOfLines,
}: HighlightTextProps) {
  if (!highlight || highlight.trim().length === 0) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  const regex = new RegExp(`(${escapeRegex(highlight.trim())})`, "gi");
  const parts = text.split(regex);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <Text
            key={i}
            style={[{ fontWeight: "800", color: "#00BCD4" }, highlightStyle]}
          >
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
