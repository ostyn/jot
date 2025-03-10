import { css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
    Activity,
    AlertTriangle,
    AlignJustify,
    ArrowRight,
    BookOpen,
    ChevronLeft,
    ChevronRight,
    createElement,
    DownloadCloud,
    Eye,
    EyeOff,
    FileText,
    Heart,
    HeartOff,
    Import,
    Info,
    Locate,
    MapPin,
    MapPinOff,
    Maximize2,
    Menu,
    Minimize2,
    PenLine,
    Play,
    Plus,
    PlusCircle,
    RefreshCw,
    Save,
    Search,
    Server,
    Settings,
    Share,
    Smile,
    SmilePlus,
    StickyNote,
    TableProperties,
    Trash2,
    TrendingUp,
    UploadCloud,
    XCircle,
} from 'lucide';

// Find Unused icons: [\\'\\"]AlertTriangle
const mapping = {
    Menu,
    Heart,
    HeartOff,
    RefreshCw,
    TableProperties,
    AlertTriangle,
    AlignJustify,
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    Eye,
    EyeOff,
    FileText,
    Maximize2,
    Minimize2,
    PenLine,
    Play,
    Plus,
    PlusCircle,
    Save,
    Search,
    Server,
    Smile,
    Trash2,
    TrendingUp,
    XCircle,
    BookOpen,
    Activity,
    Settings,
    UploadCloud,
    DownloadCloud,
    Info,
    Share,
    Import,
    SmilePlus,
    MapPin,
    MapPinOff,
    Locate,
    StickyNote,
};
export type JotIconName = keyof typeof mapping;

@customElement('jot-icon')
export class JotIcon extends LitElement {
    @property({ type: String })
    name: JotIconName = 'Smile';
    @property({ type: Object })
    size: 'small' | 'medium' | 'large' | 'xlarge' = 'medium';
    @property({ type: String })
    fillColor?: string;

    render() {
        const icon = createElement(mapping[this.name]);
        icon.classList.add(this.size);
        if (this.fillColor) icon.style.fill = this.fillColor;
        return icon;
    }
    static styles = [
        css`
            .small {
            }
            .medium {
            }
            .large {
                height: 1.5rem;
                width: 1.5rem;
            }
            .xlarge {
            }
        `,
    ];
}
