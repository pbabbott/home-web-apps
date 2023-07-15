import styled from 'styled-components';

/* eslint-disable-next-line */
export interface ButtonProps {
  type?: 'primary' | 'secondary',
  label?: string

}

export function Button(props: ButtonProps) {
  const { type, label } = props 
  const styleType = type ?? 'primary'
  

  let classes = ""

  // color
  if (styleType === 'primary') {
    classes += `bg-primary-700 `    
    classes += `hover:bg-primary-900 `
    classes += `focus:border-primary-300 `
    classes += `active:bg-primary-300 `
  }
  else if (styleType === 'secondary') {
    classes += `bg-secondary-700 `    
    classes += `hover:bg-secondary-900 `
    classes += `focus:border-secondary-300 `
    classes += `active:bg-secondary-300 `
  }

  classes += "border border-transparent "
  classes += "text-slate-50 "
  classes += "py-2 px-4 "
  classes += "outline outline-transparent "
  classes += "font-monobit text-button uppercase "

  return (
    <button className={`${classes} `} type="button">
      {label}
    </button>
  );
}

export default Button;