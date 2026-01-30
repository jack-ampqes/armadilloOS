declare module 'react-simple-maps' {
  import { ComponentType, ReactNode } from 'react'

  export interface ComposableMapProps {
    children?: ReactNode
    projection?: string
    projectionConfig?: { scale?: number; center?: [number, number] }
    className?: string
  }
  export const ComposableMap: ComponentType<ComposableMapProps>

  export interface ZoomableGroupProps {
    children?: ReactNode
    center?: [number, number]
    zoom?: number
  }
  export const ZoomableGroup: ComponentType<ZoomableGroupProps>

  export interface GeographiesProps {
    children?: (props: { geographies: GeographyObject[] }) => ReactNode
    geography?: string | object
  }
  export const Geographies: ComponentType<GeographiesProps>

  export interface GeographyObject {
    rsmKey: string
    id: string | number
    [key: string]: unknown
  }

  export interface GeographyProps {
    geography: GeographyObject
    fill?: string
    stroke?: string
    strokeWidth?: number
    style?: {
      default?: Record<string, string>
      hover?: Record<string, string>
      pressed?: Record<string, string>
    }
    onMouseEnter?: () => void
    onMouseLeave?: () => void
    onClick?: () => void
  }
  export const Geography: ComponentType<GeographyProps>
}
