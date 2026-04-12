import { css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
    Activity,
    AlertTriangle,
    AlignJustify,
    ArrowRight,
    BookOpen,
    CalendarCheck,
    CalendarPlus,
    ChartBar,
    ChevronLeft,
    ChevronRight,
    createElement,
    DownloadCloud,
    Eye,
    EyeOff,
    FileText,
    Filter,
    FilterX,
    Heart,
    Import,
    Info,
    Locate,
    LocateFixed,
    MapPin,
    Maximize2,
    Minimize2,
    PartyPopper,
    PenLine,
    Play,
    Plus,
    PlusCircle,
    RefreshCw,
    RotateCcw,
    Save,
    Search,
    Server,
    Settings,
    Share,
    Smile,
    SmilePlus,
    StickyNote,
    Trash2,
    TrendingUp,
    UploadCloud,
    XCircle,
} from 'lucide';

// Find Unused icons: [\\'\\"]AlertTriangle
const mapping = {
    CalendarCheck,
    CalendarPlus,
    ChartBar,
    Filter,
    FilterX,
    PartyPopper,
    Locate,
    LocateFixed,
    RefreshCw,
    RotateCcw,
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
    Heart,
    StickyNote,
};
export type JotIconName = keyof typeof mapping;
@customElement('jot-icon')
export class JotIcon extends LitElement {
    @property({ type: String })
    name: JotIconName = 'Smile';

    @property({ type: String })
    size: 'small' | 'medium' | 'large' | 'xlarge' = 'medium';

    @property({ type: String })
    fillColor?: string;

    @property({ type: Boolean })
    animated: boolean = false;

    @property({ type: Number })
    animationInterval: number = 1000; // Interval in milliseconds

    private animationHandle?: number;

    connectedCallback() {
        super.connectedCallback();
        if (this.animated) {
            this.startAnimation();
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.animationHandle) {
            clearInterval(this.animationHandle);
        }
    }

    updated(changedProperties: Map<string | number | symbol, unknown>) {
        super.updated(changedProperties);
        if (changedProperties.has('animated')) {
            if (this.animated) {
                this.startAnimation();
            } else {
                this.stopAnimation();
            }
        }
    }

    startAnimation() {
        if (this.animationHandle) {
            clearInterval(this.animationHandle);
        }
        this.animationHandle = window.setInterval(() => {
            this.name = this.name === 'Locate' ? 'LocateFixed' : 'Locate';
        }, this.animationInterval);
    }

    stopAnimation() {
        if (this.animationHandle) {
            clearInterval(this.animationHandle);
            this.animationHandle = undefined;
        }
    }

    render() {
        const icon = createElement(mapping[this.name]);
        icon.classList.add(this.size);
        if (this.fillColor) icon.style.fill = this.fillColor;
        return icon;
    }

    static styles = [
        css`
            :host {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                line-height: 0px;
                vertical-align: middle;
                flex: none;
            }
            .small {
                height: 1rem;
                width: 1rem;
            }
            .medium {
                height: 1.25rem;
                width: 1.25rem;
            }
            .large {
                height: 1.5rem;
                width: 1.5rem;
            }
            .xlarge {
                height: 2rem;
                width: 2rem;
            }
        `,
    ];
}
