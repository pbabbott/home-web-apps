/** @abbottland/fui-components – public API */

// Icon renderer types (provider-agnostic; implementation comes from @abbottland/fui-icons)
export type { IconRenderer, IconProps } from './types/icons';
export {
  IconRendererProvider,
  useIconRenderer,
} from './components/DiagramViewer/IconRendererContext';

// Badge
export {
  Badge,
  type BadgeProps,
  type BadgeColor,
} from './components/Badge/Badge';

// React Flow (peer: @xyflow/react)
export {
  BaseNode,
  type BaseNodeProps,
  type BaseNodeData,
  type BaseNodeType,
  type NodeColorScheme,
  type NodeProps,
} from './components/BaseNode/BaseNode';
export {
  DEFAULT_HANDLES,
  MIN_WIDTH,
  MIN_HEIGHT,
  type HandlePosition,
  type HandleType,
  type HandleConfig,
} from './components/BaseNode/BaseNode.constants';
export { DefaultEdge } from './components/DefaultEdge/DefaultEdge';
export { EditableEdge } from './components/EditableEdge/EditableEdge';
export type { EditableEdgeColor } from './components/EditableEdge/EdgeLabelContent';
export {
  DefaultNode,
  type DefaultNodeData,
} from './components/DefaultNode/DefaultNode';
export {
  LabeledNode,
  type LabeledNodeData,
} from './components/LabeledNode/LabeledNode';
export { TextNode, type TextNodeData } from './components/TextNode/TextNode';
export {
  DiagramViewer,
  type DiagramViewerProps,
} from './components/DiagramViewer/DiagramViewer';
export {
  DiagramEditor,
  type DiagramEditorProps,
} from './components/DiagramEditor/DiagramEditor';

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

// HexagonalBackground
export {
  HexagonalBackground,
  type HexagonalBackgroundProps,
} from './components/HexagonalBackground/HexagonalBackground';

// HorizontalRule
export {
  HorizontalRule,
  type HorizontalRuleProps,
} from './components/HorizontalRule/HorizontalRule';

// Input
export { Input, type InputProps } from './components/Input/Input';
export { type InputColor } from './components/Input/types';

// MaskReveal
export {
  MaskReveal,
  type MaskRevealProps,
  type MaskRevealDirection,
} from './components/MaskReveal/MaskReveal';

// DropdownMenu
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  type DropdownMenuContentProps,
} from './components/DropdownMenu/DropdownMenu';
export {
  DropdownMenuItem,
  type DropdownMenuItemProps,
} from './components/DropdownMenu/DropdownMenuItem';

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
