/**
 * Azerbaijani visual motifs, drawn from scratch for Unibridge (no third-party
 * artwork): the 8-point star from the flag, the buta (paisley) from carpets
 * and textiles, the tricolour stripe, and a stylised Flame Towers skyline.
 * All are decorative and hidden from screen readers.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Path, Polygon, Rect, Stop } from "react-native-svg";

import { decorativeProps } from "../common/a11y";
import { palette } from "../../styles/theme";

function starPoints(cx: number, cy: number, outer: number): string {
  // Octagram outline formed by two overlapping squares, as on the flag.
  const inner = outer * (Math.cos(Math.PI / 4) / Math.cos(Math.PI / 8));
  const points: string[] = [];
  for (let index = 0; index < 16; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 8) * index - Math.PI / 2;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return points.join(" ");
}

export function EightPointStar({
  color = palette.saffron,
  size = 16,
  style,
}: {
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View {...decorativeProps} style={style}>
      <Svg height={size} viewBox="0 0 24 24" width={size}>
        <Polygon fill={color} points={starPoints(12, 12, 12)} />
      </Svg>
    </View>
  );
}

// One buta motif in a 48x48 box: teardrop body with a curled tip and an
// inner echo line, the way it appears in Azerbaijani carpets and kelaghayi.
const BUTA_BODY =
  "M30 6 C40 10 44 22 40 32 C36 42 24 46 16 41 C8 36 8 25 15 21 C21 18 27 22 25 28 C24 31 20 32 18 30";
const BUTA_INNER = "M31 13 C37 17 38 25 35 31 C32 37 24 40 19 37";

export function Buta({
  color = palette.saffron,
  size = 48,
  strokeWidth = 2.2,
}: {
  color?: string;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <Svg height={size} viewBox="0 0 48 48" width={size}>
      <Path d={BUTA_BODY} fill="none" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
      <Path d={BUTA_INNER} fill="none" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth * 0.7} />
      <Circle cx={22} cy={33} fill={color} r={1.6} />
    </Svg>
  );
}

/**
 * Low-contrast pattern of butas and stars for dark hero backgrounds.
 * Absolutely fills its parent; place it first inside a positioned container.
 */
export function HeroPattern({ opacity = 0.14 }: { opacity?: number }) {
  // Kept clear of the top row (brand, language, and sign-out controls).
  const motifs = [
    { kind: "buta", rotate: -20, x: 0.7, y: 0.36, size: 86 },
    { kind: "star", rotate: 0, x: 0.9, y: 0.7, size: 20 },
    { kind: "buta", rotate: 150, x: 0.5, y: 0.74, size: 40 },
    { kind: "star", rotate: 0, x: 0.62, y: 0.34, size: 10 },
    { kind: "star", rotate: 0, x: 0.95, y: 0.36, size: 8 },
  ] as const;

  return (
    <View {...decorativeProps} pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      {motifs.map((motif, index) => (
        <View
          key={index}
          style={{
            left: `${motif.x * 100}%`,
            position: "absolute",
            top: `${motif.y * 100}%`,
            transform: [{ rotate: `${motif.rotate}deg` }],
          }}
        >
          {motif.kind === "buta" ? (
            <Buta color="#FFFFFF" size={motif.size} strokeWidth={2.4} />
          ) : (
            <Svg height={motif.size} viewBox="0 0 24 24" width={motif.size}>
              <Polygon fill="#FFFFFF" points={starPoints(12, 12, 12)} />
            </Svg>
          )}
        </View>
      ))}
    </View>
  );
}

/** Thin sky-blue / red / green band, echoing the flag. */
export function FlagStripe({ height = 4, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View {...decorativeProps} style={[{ flexDirection: "row", height }, style]}>
      <View style={{ backgroundColor: palette.flagBlue, flex: 1 }} />
      <View style={{ backgroundColor: palette.flagRed, flex: 1 }} />
      <View style={{ backgroundColor: palette.flagGreen, flex: 1 }} />
    </View>
  );
}

// A flame-shaped tower: straight base, sides sweeping in to an off-centre tip.
function flamePath(x: number, width: number, height: number, base: number): string {
  const top = base - height;
  return [
    `M${x} ${base}`,
    `C${x} ${base - height * 0.45} ${x + width * 0.08} ${top + height * 0.25} ${x + width * 0.62} ${top}`,
    `C${x + width * 0.92} ${top + height * 0.3} ${x + width} ${base - height * 0.4} ${x + width} ${base}`,
    "Z",
  ].join(" ");
}

/** Stylised Baku skyline (Flame Towers) glowing over the Caspian at night. */
export function FlameSkyline({ height = 150, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const base = 150;
  const towers = [
    { x: 92, width: 58, height: 104 },
    { x: 146, width: 70, height: 138 },
    { x: 212, width: 60, height: 116 },
  ];

  return (
    <View {...decorativeProps} pointerEvents="none" style={style}>
      <Svg height={height} preserveAspectRatio="xMidYMax meet" viewBox="0 0 360 160" width="100%">
        <Defs>
          <LinearGradient id="flame" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={palette.saffron} stopOpacity="0.95" />
            <Stop offset="0.55" stopColor="#E9673A" stopOpacity="0.85" />
            <Stop offset="1" stopColor={palette.pomegranate} stopOpacity="0.55" />
          </LinearGradient>
          <LinearGradient id="sea" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={palette.flagBlue} stopOpacity="0.35" />
            <Stop offset="1" stopColor={palette.flagBlue} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {/* Old City walls and Maiden Tower, low on the left. */}
        <Path d="M10 150 L10 128 L24 128 L24 120 L36 120 L36 128 L58 128 L58 150 Z" fill="#FFFFFF" opacity={0.12} />
        <Path d="M64 150 L64 104 C64 98 82 98 82 104 L82 150 Z" fill="#FFFFFF" opacity={0.16} />
        <G>
          {towers.map((tower) => (
            <Path d={flamePath(tower.x, tower.width, tower.height, base)} fill="url(#flame)" key={tower.x} />
          ))}
        </G>
        {/* Window rhythm on the towers. */}
        {towers.map((tower) =>
          [0.25, 0.45, 0.65].map((step) => (
            <Rect
              fill="#FFFFFF"
              height={1.4}
              key={`${tower.x}-${step}`}
              opacity={0.35}
              width={tower.width * 0.5}
              x={tower.x + tower.width * 0.25}
              y={base - tower.height * step}
            />
          )),
        )}
        <Path d="M290 150 L290 132 L314 132 L314 124 L330 124 L330 150 Z" fill="#FFFFFF" opacity={0.12} />
        <Rect fill="url(#sea)" height={10} width={360} x={0} y={150} />
      </Svg>
    </View>
  );
}
