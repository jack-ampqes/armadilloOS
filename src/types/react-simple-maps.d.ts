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

  export interface MarkerProps {
    coordinates: [number, number]  // [longitude, latitude]
    children?: ReactNode
    onMouseEnter?: (evt: React.MouseEvent) => void
    onMouseLeave?: (evt: React.MouseEvent) => void
    onMouseDown?: (evt: React.MouseEvent) => void
    onMouseUp?: (evt: React.MouseEvent) => void
    onFocus?: (evt: React.FocusEvent) => void
    onBlur?: (evt: React.FocusEvent) => void
    style?: {
      default?: Record<string, string>
      hover?: Record<string, string>
      pressed?: Record<string, string>
    }
    className?: string
  }
  export const Marker: ComponentType<MarkerProps>

  export function useMapContext(): {
    width: number
    height: number
    projection: (coords: [number, number]) => [number, number] & { invert?: (point: [number, number]) => [number, number] }
    path: ((geo: object) => string) & { centroid?: (geo: object) => [number, number] }
  }
  export function useZoomPanContext(): {
    x: number
    y: number
    k: number
    transformString: string
  }
}
