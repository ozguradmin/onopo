// The admin dashboard is /admin. The older page that lived here read a stats response shape that no
// longer exists (it showed only zeros) and was not in the sidebar, so old bookmarks get a plain redirect.
export function GET() {
    return new Response(null, { status: 307, headers: { Location: '/admin/' } })
}
