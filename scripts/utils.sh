# Function to update or add a key-value pair in the .env file
update_env_file() {
    if [ $# -ne 3 ]; then
        echo "Usage: update_env_file <file> <key> <value>"
        return 1
    fi
    
    local file=$1
    local key=$2
    local value=$3
    if grep -q "^${key}=" $file; then
        sed -i "s/^${key}=.*/${key}=${value}/" $file
    else
        echo "${key}=${value}" >> $file
    fi
}
