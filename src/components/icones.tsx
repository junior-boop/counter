
import Svg, { G, Path } from 'react-native-svg';

export function LucideHouse({ color = 'currentColor', size = 24, ...rest }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>{/* Icon from Lucide by Lucide Contributors - https://github.com/lucide-icons/lucide/blob/main/LICENSE */}<G fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><Path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><Path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></G></Svg>
    );
}

export function LucideChevronRight({ color = 'currentColor', size = 24, ...rest }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>{/* Icon from Lucide by Lucide Contributors - https://github.com/lucide-icons/lucide/blob/main/LICENSE */}<Path fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m9 18l6-6l-6-6" /></Svg>
    )
}