/**
 * Lucide icon for a category, from the icon name the admin picked (Admin › Kategoriler iconOptions).
 * Unknown names fall back to a box. Decorative: always aria-hidden.
 */
import * as React from 'react'
import {
    Anchor, Armchair, Award, Baby, Bike, Book, Briefcase, Calculator, Camera, Car, Cloud, Coffee, Compass,
    Crown, Dog, Dumbbell, Film, Flower2, Gamepad2, Gift, Globe, Hammer, Headphones, Heart, Home, Key,
    Keyboard, Laptop, Lock, Map as MapIcon, Medal, Monitor, Moon, Mouse, Music, Package, Palette, Phone, Plane, Printer,
    Scissors, Shirt, ShoppingBag, Smartphone, Sparkles, Speaker, Star, Sun, Tablet, Trophy, Tv, Umbrella,
    Utensils, Watch, Zap, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
    laptop: Laptop, sparkles: Sparkles, gamepad: Gamepad2, package: Package, zap: Zap, tool: Hammer,
    heart: Heart, shirt: Shirt, home: Home, furniture: Armchair, camera: Camera, headphones: Headphones,
    watch: Watch, gift: Gift, shopping: ShoppingBag, star: Star, tv: Tv, phone: Phone, tablet: Tablet,
    monitor: Monitor, printer: Printer, speaker: Speaker, keyboard: Keyboard, mouse: Mouse, coffee: Coffee,
    kitchen: Utensils, book: Book, bike: Bike, car: Car, plane: Plane, music: Music, film: Film,
    palette: Palette, office: Briefcase, baby: Baby, sport: Dumbbell, pet: Dog, garden: Flower2,
    beauty: Scissors, sea: Anchor, sun: Sun, moon: Moon, cloud: Cloud, umbrella: Umbrella, key: Key,
    lock: Lock, map: MapIcon, compass: Compass, globe: Globe, award: Award, medal: Medal, crown: Crown,
    trophy: Trophy, calculator: Calculator, smartphone: Smartphone,
}

export function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
    const Icon = ICONS[(name || '').toLowerCase()] ?? Package
    return <Icon className={cn('h-5 w-5', className)} aria-hidden="true" strokeWidth={1.75} />
}
