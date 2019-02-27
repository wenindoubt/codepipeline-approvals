# Builds all handlers for dev then runs tests for each
pushd email_handler
yarn
yarn test
popd

pushd slack_handler
yarn
yarn test
popd
