import Svg, { Path, Circle } from 'react-native-svg';

/** Cúp giải thưởng / trúng thưởng. */
export default ({ width = 24, height = 24, color = '#000' }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    {/* Chén cúp */}
    <Path
      d="M7 4h10v4a5 5 0 0 1-10 0V4z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
    {/* Tai trái */}
    <Path
      d="M7 5.5H4.5A.5.5 0 0 0 4 6v1.5a2.5 2.5 0 0 0 2.5 2.5H7"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
    {/* Tai phải */}
    <Path
      d="M17 5.5h2.5a.5.5 0 0 1 .5.5v1.5a2.5 2.5 0 0 1-2.5 2.5H17"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
    {/* Thân cúp */}
    <Path
      d="M12 13v3"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
    {/* Đế cúp */}
    <Path
      d="M9 19h6"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Path
      d="M10 16h4"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
    {/* Ngôi sao giữa cúp */}
    <Circle cx={12} cy={7} r={1.3} fill={color} />
  </Svg>
);
