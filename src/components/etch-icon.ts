import { css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
    Activity,
    AlertTriangle,
    AlignJustify,
    Archive,
    ArrowRight,
    BookOpen,
    ChevronLeft,
    ChevronRight,
    Copy,
    createElement,
    Eye,
    EyeOff,
    FileText,
    Inbox,
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
    Smile,
    Trash,
    Trash2,
    TrendingUp,
    Wrench,
    XCircle,
} from 'lucide';

const mapping = {
    AlertTriangle,
    AlignJustify,
    Archive,
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    Copy,
    Eye,
    EyeOff,
    FileText,
    Inbox,
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
    Smile,
    Trash,
    Trash2,
    TrendingUp,
    Wrench,
    XCircle,
    BookOpen,
    Activity,
    Settings,
};
export type EtchIconName = keyof typeof mapping;

@customElement('etch-icon')
export class EtchIcon extends LitElement {
    @property({ type: String })
    name: EtchIconName = 'Menu';
    @property({ type: Object })
    size: 'small' | 'medium' | 'large' | 'xlarge' = 'medium';
    render() {
        const icon = createElement(mapping[this.name] || Menu);
        icon.classList.add(this.size);
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
