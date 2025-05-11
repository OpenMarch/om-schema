# om-schema

Database schema and migrations for OpenMarch

## Development setup

1. Install [Bun](https://bun.sh/docs/installation)
1. Install dependencies

   ```bash
   bun install
   ```

1. Add [Husky config file](https://typicode.github.io/husky/how-to.html#startup-files) (referenced from [this issue](https://github.com/oven-sh/bun/issues/10691#issuecomment-2868116728))

   1. Look at how to find your [Bun path](https://bun.sh/docs/installation#how-to-add-your-path)

   ```bash
   # in MacOS or linux
   mkdir ~/.config/husky --parents
   echo "export BUN_INSTALL=$HOME/.bun" >> ~/.config/husky/init.sh
   echo "export PATH=${BUN_INSTALL}/bin:$PATH" >> ~/.config/husky/init.sh
   ```
