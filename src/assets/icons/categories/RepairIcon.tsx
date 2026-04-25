import Svg, { Path } from 'react-native-svg';

/** Cờ-lê + tua-vít chéo. */
export default ({ width = 24, height = 24, color = '#000' }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    {/* Cờ-lê (wrench) */}
    <Path
      d="M15 3a4.5 4.5 0 0 0-4 6.5L3.5 17a1.5 1.5 0 0 0 2.1 2.1L13 11.7A4.5 4.5 0 1 0 15 3z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
    <Path
      d="M16.5 4.5l-2 2 2 2 2-2"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Điểm vít nhỏ nơi tay cầm */}
    <Path
      d="M4.5 18l1 1"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
  </Svg>
);
