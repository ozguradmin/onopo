
import { Phone, Mail, Facebook, Instagram, Twitter, Youtube } from "lucide-react"

export function TopBar() {
    return (
        <div className="bg-slate-900 text-white text-xs py-2 hidden md:block">
            <div className="container mx-auto px-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <a href="tel:05058217547" className="flex items-center gap-1 hover:text-slate-300 transition-colors">
                        <Phone className="w-3 h-3" />
                        <span>0505 821 75 47</span>
                    </a>
                    <a href="mailto:onopostore@gmail.com" className="flex items-center gap-1 hover:text-slate-300 transition-colors">
                        <Mail className="w-3 h-3" />
                        <span>onopostore@gmail.com</span>
                    </a>
                </div>
                <div className="flex items-center gap-3">
                    <a href="https://www.facebook.com/people/Onopostorecom/61572923320449/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
                        <Facebook className="w-3 h-3" />
                    </a>
                    <a href="https://x.com/onopostore" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
                        <Twitter className="w-3 h-3" />
                    </a>
                    <a href="https://www.instagram.com/onopostorecom/?igsh=aXgyYzMxbWlnaHJ0&utm_source=qr#" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
                        <Instagram className="w-3 h-3" />
                    </a>
                    <a href="https://www.youtube.com/@onopostore" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
                        <Youtube className="w-3 h-3" />
                    </a>
                </div>
            </div>
        </div>
    )
}
