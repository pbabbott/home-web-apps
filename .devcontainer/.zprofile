# .zprofile
# Set up environment variables and path configurations
export PATH="$HOME/.local/bin:$PATH"
export PATH="/home/vscode/.local/share/fnm:$PATH"

# Set default editor
export EDITOR=vim
export VISUAL=code

# Add custom bin directories
export PATH="$HOME/bin:$PATH"

# Increase history size and settings
export HISTSIZE=10000
export SAVEHIST=10000
export HISTFILE=~/.zsh_history
