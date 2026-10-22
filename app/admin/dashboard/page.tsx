import { redirect } from 'next/navigation'

// The admin dashboard is /admin. This older page read a stats response shape that no longer exists
// (it showed only zeros) and is not in the sidebar, so old bookmarks are sent to /admin.
export default function AdminDashboardRedirect() {
    redirect('/admin/')
}
