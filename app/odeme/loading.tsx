import { CheckoutSkeleton } from '@/components/checkout/CheckoutSkeleton'

// Shown during client-side navigation to /odeme/ (e.g. from the cart drawer) until the page arrives.
export default function CheckoutLoading() {
    return <CheckoutSkeleton />
}
