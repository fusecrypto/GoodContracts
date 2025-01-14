const fse = require("fs-extra");
const settings = require("../../migrations/deploy-settings.json");
const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
const SchemeRegistrar = artifacts.require("./SchemeRegistrar.sol");
const ChangeAuthPeriod = artifacts.require("./ChangeAuthPeriod.sol");

const releaser = require("../../../scripts/releaser.js");
const getFounders = require("../../../migrations/getFounders");
const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const NULL_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

const getNetworkName = () => {
  const argslist = process.argv;
  let found = false;
  for (let i in argslist) {
    const item = argslist[i];
    if (found) return item;
    if (item && item.indexOf("network") >= 0) found = true;
  }
  return;
};

/**
 * truffle helper script to upgrade the ubischeme
 */
const upgrade = async function() {
  const network = getNetworkName();
  if (network.includes("mainnet") === true) {
    console.log("can only run on home network");
    return;
  }
  const networkSettings = { ...settings["default"], ...settings[network] };
  const daoAddresses = require("../../../releases/deployment.json");
  const homedao = daoAddresses[network];

  const founders = await getFounders(AbsoluteVote.web3, network);
  console.log({ network, networkSettings, homedao, founders });
  const periodupdate = await ChangeAuthPeriod.new(homedao.Avatar, homedao.Identity, 120);

  console.log("Scheme deployed at:", {
    scheme: periodupdate.address,
    newAuthPeriod: 120
  });

  console.log("proposing Update to DAO");
  const absoluteVote = await AbsoluteVote.at(homedao.AbsoluteVote);
  const schemeRegistrar = await SchemeRegistrar.at(homedao.SchemeRegistrar);

  const proposal = await schemeRegistrar.proposeScheme(
    homedao.Avatar,
    periodupdate.address,
    NULL_HASH,
    "0x00000010",
    NULL_HASH
  );

  let proposalId = proposal.logs[0].args._proposalId;

  console.log("voting...", { proposalId });

  await Promise.all(
    founders
      .slice(0, Math.ceil(founders.length / 2))
      .map(f => absoluteVote.vote(proposalId, 1, 0, f, { from: f, gas: 500000 }))
  );

  console.log("starting...");
  await periodupdate.setAuthPeriod();
};

module.exports = done => {
  upgrade()
    .catch(console.log)
    .then(done);
};
