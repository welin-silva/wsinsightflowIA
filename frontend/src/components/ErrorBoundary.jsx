import { Component } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'An unexpected error occurred' }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  reset() {
    this.setState({ hasError: false, errorMessage: '' })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-red-500/15 bg-red-500/[0.03]">
          <div className="w-12 h-12 rounded-2xl border border-red-500/20 bg-red-500/5 flex items-center justify-center mb-5">
            <AlertCircle className="w-5 h-5 text-red-400" strokeWidth={1.5} />
          </div>
          <p className="font-grotesk text-base font-semibold text-[#F5F5F5] mb-2">
            Failed to render this section
          </p>
          <p className="font-inter text-sm text-[#9CA3AF] text-center max-w-sm mb-6 leading-relaxed">
            {this.state.errorMessage}
          </p>
          <button
            onClick={() => this.reset()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] text-sm font-inter text-[#9CA3AF] hover:text-[#F5F5F5] hover:border-white/15 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
