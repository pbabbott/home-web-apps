import { ReactNode } from "react"

export type PanelProps = {
    type?: 'default' | 'white' | 'primary' | 'secondary',
    variant?: 'transparent' | 'outlined',
    children?: ReactNode
}

type SvgSquareProps = {
    className: string
}
const SvgSquare = (props: SvgSquareProps) => {
    const {className} = props
    return (
        <svg className={className} width="10" height="10">
            <rect width="10" height="10" x="0" y="0" />
        </svg>
    )
}

type DecorativeBarProps = {
    squareClassName: string
}
const DecorativeBar = (props: DecorativeBarProps) => {
    const {squareClassName} = props
    return (
        <div className="flex justify-between">
            <SvgSquare className={squareClassName} />
            <SvgSquare className={squareClassName} />
        </div>
    )
}
  
export function Panel(props: PanelProps = {
    type: "primary",
    variant: 'transparent'
  }) {
    const { type, children } = props 
    
    let classes = ""
    let squareClassName = ""

    switch(type) {
        case 'default':
            classes += `bg-slate-600/70 `
            squareClassName = 'fill-slate-300'
            break;
        case 'white':
            classes += `bg-slate-50/70 `    
            squareClassName = 'fill-slate-50'
            break;
        case 'primary':
            classes += `bg-primary-700/60 `    
            squareClassName = 'fill-primary-300'
            break;
        case 'secondary':
            classes += `bg-secondary-700/60 `    
            squareClassName = 'fill-secondary-300'
            break;
    }
  
    return (
      <div className={`${classes}`}>
        <DecorativeBar squareClassName={squareClassName} />
        <div className="py-2 px-4">
            {children}
        </div>
        <DecorativeBar squareClassName={squareClassName} />
      </div>
    );
  }
  
  export default Panel;