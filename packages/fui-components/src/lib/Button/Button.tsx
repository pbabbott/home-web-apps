import styled from 'styled-components';

export type ButtonProps = {
  type?: 'primary' | 'secondary',
  label?: string,
  disabled?: boolean,
  onClick?: React.MouseEventHandler<HTMLButtonElement>
}

export function Button(props: ButtonProps = {
  type: "primary",
  label: "button",
  disabled: false,
}) {
  const { type, label, disabled, onClick } = props 
  
  let classes = ""

  // color
  if (disabled === true) {
    classes += `bg-slate-700 `    
    classes += `text-slate-400 `    
  } 
  else if (type === 'primary') {
    classes += `bg-primary-700 `    
    classes += `hover:bg-primary-900 `
    classes += `focus:border-primary-300 `
    classes += `active:bg-primary-300 `
    classes += `text-slate-50 `    
  }
  else if (type === 'secondary') {
    classes += `bg-secondary-700 `    
    classes += `hover:bg-secondary-900 `
    classes += `focus:border-secondary-300 `
    classes += `active:bg-secondary-300 `
    classes += `text-slate-50 `    
  }

  classes += "border border-transparent "
  classes += "py-2 px-4 "
  classes += "outline outline-transparent "
  classes += "font-monobit text-button uppercase "

  return (
    <button className={`${classes}`} type="button" onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

export default Button;