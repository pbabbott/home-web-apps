export type TextProps = {
    label?: string,
    font: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body1' | 'body2' | 'button' | 'caption' | 'small'
    TagOverride?: string
}

export function Text(props: TextProps = {
    font: 'body2'
}) {

    const { label, font, TagOverride } = props

    let DefaultTag = ''
    let textClasses = 'text-slate-50 '


    switch(font) {
        case 'h1':
            textClasses += 'font-future_z uppercase text-header-1'
            DefaultTag = 'h1'
            break;
        case 'h2':
            textClasses += 'font-future_z uppercase text-header-2'
            DefaultTag = 'h2'
            break;
        case 'h3':
            textClasses += 'font-monobit uppercase text-header-3'
            DefaultTag = 'h3'
            break;
        case 'h4':
            textClasses += 'font-monobit uppercase text-header-4'
            DefaultTag = 'h4'
            break;
        case 'h5':
            textClasses += 'font-monobit uppercase text-header-5'
            DefaultTag = 'h5'
            break;
        case 'h6':
            textClasses += 'font-monobit uppercase text-header-6'
            DefaultTag = 'h6'
            break;
        case 'body1':
            textClasses += 'font-monobit text-body-1'
            DefaultTag = 'span'
            break;
        case 'body2':
            textClasses += 'font-monobit text-body-2'
            DefaultTag = 'span'
            break;
        case 'button':
            textClasses += 'font-monobit text-button'
            DefaultTag = 'span'
            break;
        case 'caption':
            textClasses += 'font-monobit text-caption'
            DefaultTag = 'span'
            break;
        case 'small':
            textClasses += 'font-monobit text-small'
            DefaultTag = 'span'
            break;
    
    }

    const Tag = (TagOverride ?? DefaultTag ) as keyof JSX.IntrinsicElements

    return (
        <Tag className={textClasses}>{label}</Tag>
    )
}