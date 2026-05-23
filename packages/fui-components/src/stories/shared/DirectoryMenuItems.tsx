import {
  CubeIcon,
  StackIcon,
  QuestionMarkCircledIcon,
} from '@radix-ui/react-icons';
import { DropdownMenuItem } from '../../components/DropdownMenu/DropdownMenuItem';

export const DirectoryMenuItems = () => (
  <>
    <DropdownMenuItem icon={StackIcon}>Series</DropdownMenuItem>
    <DropdownMenuItem icon={QuestionMarkCircledIcon}>
      System Architecture
    </DropdownMenuItem>
    <DropdownMenuItem icon={CubeIcon}>FUI Components</DropdownMenuItem>
  </>
);
