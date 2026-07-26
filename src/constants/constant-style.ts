import { Dimensions } from 'react-native'
const w = Dimensions.get('screen').width
const h = Dimensions.get('screen').height

const TABLET_BREAKPOINT = 768
const isTablet = w >= TABLET_BREAKPOINT
const scale = (base: number) => (isTablet ? Math.round(base * 1.2) : base)

export default {
    isTablet,
    screenPadding : scale(20),
    size_one : scale(13),
    size_two : scale(16),
    size_three : scale(18),
    size_four : scale(24),
    size_five : scale(28),
    size_six : scale(32),
    radius : scale(24),
    internal_radius : scale(12),
    internal_radius_2 : scale(4),
    internal_padding : scale(12),
    internal_padding_2: scale(8),
    headerHeight: isTablet ? 84 : 72,
    touchTarget: isTablet ? 44 : 32,
    contentMaxWidth: isTablet ? 640 : w,
    inner_with_screen : w,
    inner_height_screen : h
}