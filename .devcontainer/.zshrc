
# .zshrc
# Enable Oh My Zsh if installed
if [ -f "$HOME/.oh-my-zsh/oh-my-zsh.sh" ]; then
    export ZSH="$HOME/.oh-my-zsh"
    ZSH_THEME="agnoster"
    plugins=(git docker npm node fnm)
    source $ZSH/oh-my-zsh.sh
fi

# Initialize fnm
eval "$(fnm env --use-on-cd)"

# Aliases for development
alias nr="pnpm run"
alias nx="npx"
alias lg="lazygit"
alias t="turbo"

# Git aliases
alias gs="git status"
alias ga="git add"
alias gc="git commit"
alias gp="git push"

# Development shortcuts
alias cdp="cd ~/projects"

# Improve autocompletion
autoload -U compinit
compinit

# Enable color support
autoload -U colors
colors

# Better history search
bindkey '^R' history-incremental-search-backward

# Print a startup message
echo "Welcome to your development environment!"
echo "Current Node.js version: $(node -v)"
echo "Current pnpm version: $(pnpm -v)"

eval "$(fnm env --use-on-cd --shell zsh)"