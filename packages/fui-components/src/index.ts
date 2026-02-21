/** @abbottland/fui-components – public API */

// Badge
export {
  Badge,
  type BadgeProps,
  type BadgeColor,
} from './components/Badge/Badge';

// React Flow (peer: @xyflow/react)
export {
  BaseNode,
  DEFAULT_HANDLES,
  MIN_WIDTH,
  MIN_HEIGHT,
  type BaseNodeProps,
  type BaseNodeData,
  type BaseNodeType,
  type NodeColorScheme,
  type HandlePosition,
  type HandleType,
  type HandleConfig,
  type NodeProps,
} from './components/BaseNode/BaseNode';
export { DefaultEdge } from './components/DefaultEdge/DefaultEdge';
export { EditableEdge } from './components/EditableEdge/EditableEdge';

// Button
export {
  Button,
  type ButtonProps,
  type ButtonColor,
  type ButtonVariant,
} from './components/Button/Button';

// Card
export {
  Card,
  type CardProps,
  type CardColor,
  type CardSize,
} from './components/Card/Card';

// DotGridBackground
export {
  DotGridBackground,
  type DotGridBackgroundColor,
  type DotGridBackgroundProps,
} from './components/DotGridBackground/DotGridBackground';

// HorizontalRule
export {
  HorizontalRule,
  type HorizontalRuleProps,
} from './components/HorizontalRule/HorizontalRule';

// Input
export { Input, type InputProps } from './components/Input/Input';
export { type InputColor } from './components/Input/types';

// NavBar
export { NavBar, type NavBarProps } from './components/NavBar/NavBar';

// NavItem
export { NavItem, type NavItemProps } from './components/NavItem/NavItem';

// Panel
export { Panel, type PanelProps } from './components/Panel/Panel';
export { type PanelColor } from './components/Panel/types';

// TransparentPanel
export {
  TransparentPanel,
  type TransparentPanelProps,
} from './components/TransparentPanel/TransparentPanel';
export { type TransparentPanelColor } from './components/TransparentPanel/types';

// Table
export {
  Table,
  TableHead,
  TableBody,
  TableRow,
  Th,
  Td,
  type TableProps,
  type TableHeadProps,
  type TableBodyProps,
  type TableRowProps,
  type ThProps,
  type TdProps,
  type TableColor,
} from './components/Table/Table';

// HexagonButton & TiledHexagons
export {
  HexagonButton,
  type HexagonButtonProps,
} from './components/HexagonButton/HexagonButton';
export {
  TiledHexagons,
  type TiledHexagonsProps,
  type TiledHexagonTile,
} from './components/TiledHexagons/TiledHexagons';

// Typography
export {
  Typography,
  type TypographyProps,
  type TypographyVariant,
  type TypographyComponent,
} from './components/Typography/Typography';

// Utils & tokens
export { extendedTwMerge } from './utils/extendTwMerge';
export {
  neutral,
  primary,
  secondary,
  accentPurple,
  accentFalcon,
  success,
  warning,
  error,
  brandColors,
  gradient,
  type ColorShade,
} from './tokens';
