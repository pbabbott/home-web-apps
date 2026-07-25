import {execa} from 'execa'

export const executeCommand = async (command: string, args: string[], options: {inherit?: boolean} = {}) => {
  console.log(`🪄  Executing command:\n\n\t${command} ${args.join(' ')}\n`)
  return await execa(command, args, options.inherit ? {stdio: 'inherit'} : {})
}
