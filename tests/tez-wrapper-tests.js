const {
    deploy,
    getAccount,
    getValueFromBigMap,
    setQuiet,
    expectToThrow,
    exprMichelineToJson,
    setMockupNow,
    isMockup,
    setEndpoint
} = require('@completium/completium-cli');
const { errors, mkTransferPermit, mkTransferGaslessArgs } = require('./utils');
const assert = require('assert');

require('mocha/package.json');

setQuiet('true');

const mockup_mode = true;

// contracts
let wrapper;

// accounts
const alice = getAccount(mockup_mode ? 'alice' : 'alice');
const bob = getAccount(mockup_mode ? 'bob' : 'bob');
const carl = getAccount(mockup_mode ? 'carl' : 'carl');
const daniel = getAccount(mockup_mode ? 'bootstrap1' : 'bootstrap1');

//set endpointhead
setEndpoint(mockup_mode ? 'mockup' : 'https://hangzhounet.smartpy.io');

const amount = "100";
const unit = "tz"
let tokenId = 0;
const testAmount_1 = 1;
const testAmount_2 = 11;
const burnAmount = 2;

let alicePermitNb = 0;
let carlPermitNb = 0;

// permits
let permit;

async function expectToThrowMissigned(f, e) {
    const m = 'Failed to throw' + (e !== undefined ? e : '');
    try {
        await f();
        throw new Error(m);
    } catch (ex) {
        if ((ex.message && e !== undefined) || (ex && e !== undefined)) {
            if (ex.message)
                assert(
                    ex.message.includes(e),
                    `${e} was not found in the error message`
                );
            else
                assert(
                    ex.includes(e),
                    `${e} was not found in the error message`
                );
        } else if (ex.message === m) {
            throw e;
        }
    }
}

async function expectToThrowTezosError(f, e) {
    if (e === undefined) {
      throw new Error("expectToThrow: error must be defined")
    }
    const m = "Failed to throw" + e;
    try {
      await f();
      throw new Error(m)
    } catch (ex) {
      if (ex) {
        assert(
            ex.includes(e),
            `${e} was not found in the error message`
        );
      } else {
        throw ex
      }
    }
  }

describe('Tez Wrapper Contract deployment', async () => {
    it('Tez Wrapper contract deployment should succeed', async () => {
        [wrapper, _] = await deploy(
            './contract/tez-wrapper.arl',
            {
                parameters: {
                    owner: alice.pkh,
                },
                as: alice.pkh,
            }
        );
    });
});

describe('Wrapped Minting', async () => {
    it('Mint Wrapped Tez as owner for ourself should succeed', async () => {
        await wrapper.wrap({
            arg: {
                iowner: alice.pkh,
            },
            amount: amount + unit,
            as: alice.pkh,
        });
        const storage = await wrapper.getStorage();
        var balance = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${alice.pkh}")`),
            exprMichelineToJson(`(pair nat address)'`)
        );
        assert(parseInt(balance.int) == parseInt(amount * 1_000_000));
    });

    it('Mint Wrapped Token as non owner for owner should succeed', async () => {
        await wrapper.wrap({
            arg: {
                iowner: alice.pkh,
            },
            amount: amount + unit,
            as: bob.pkh,
        });
        const storage = await wrapper.getStorage();
        var balance = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${alice.pkh}")`),
            exprMichelineToJson(`(pair nat address)'`)
        );
        assert(parseInt(balance.int) == parseInt(amount * 1_000_000 * 2));
    });

    it('Mint Wrapped Token as owner for non owner should succeed', async () => {
        await wrapper.wrap({
            arg: {
                iowner: bob.pkh,
            },
            amount: amount + unit,
            as: alice.pkh,
        });
        const storage = await wrapper.getStorage();
        var balance = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${bob.pkh}")`),
            exprMichelineToJson(`(pair nat address)'`)
        );
        assert(parseInt(balance.int) == parseInt(amount * 1_000_000));
    });

    it('Mint Wrapped Tez tokens as non owner for someone else should succeed', async () => {
        await wrapper.wrap({
            arg: {
                iowner: carl.pkh,
            },
            amount: amount + unit,
            as: bob.pkh,
        });
        const storage = await wrapper.getStorage();
        var balance = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${carl.pkh}")`),
            exprMichelineToJson(`(pair nat address)'`)
        );
        assert(parseInt(balance.int) == parseInt(amount * 1_000_000));
    });

    it('Mint Wrapped Tez as owner for someone else should succeed', async () => {
        await wrapper.wrap({
            arg: {
                iowner: bob.pkh,
            },
            amount: amount + unit,
            as: carl.pkh,
        });
        const storage = await wrapper.getStorage();
        var balance = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${bob.pkh}")`),
            exprMichelineToJson(`(pair nat address)'`)
        );
        assert(parseInt(balance.int) == parseInt(amount * 1_000_000 * 2));
    });

    it('Re-Mint Wrapped Tez should succeed', async () => {
        await wrapper.wrap({
            arg: {
                iowner: alice.pkh,
            },
            amount: amount + unit,
            as: alice.pkh,
        });
        const storage = await wrapper.getStorage();
        var balance = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${alice.pkh}")`),
            exprMichelineToJson(`(pair nat address)'`)
        );
        assert(parseInt(balance.int) == parseInt(amount * 1_000_000 * 3));
    });

    it('Mint more tokens than owned tez should fail', async () => {
        await expectToThrowTezosError(async () => {
            await wrapper.wrap({
                arg: {
                    iowner: alice.pkh,
                },
                amount: "999999999999" + unit,
                as: alice.pkh,
            });
        }, "Balance of contract "+alice.pkh+" too low");
    });
});

describe('Update operators', async () => {
    it('Add an operator for ourself should succeed', async () => {
        const storage = await wrapper.getStorage();
        var initialOperators = await getValueFromBigMap(
            parseInt(storage.operator),
            exprMichelineToJson(
                `(Pair "${wrapper.address}" (Pair ${tokenId} "${alice.pkh}"))`
            ),
            exprMichelineToJson(`(pair address (pair nat address))'`)
        );
        assert(initialOperators == null);
        await wrapper.update_operators({
            argMichelson: `{Left (Pair "${alice.pkh}" "${wrapper.address}" ${tokenId})}`,
            as: alice.pkh,
        });
        var operatorsAfterAdd = await getValueFromBigMap(
            parseInt(storage.operator),
            exprMichelineToJson(
                `(Pair "${wrapper.address}" (Pair ${tokenId} "${alice.pkh}"))`
            ),
            exprMichelineToJson(`(pair address (pair nat address))'`)
        );
        assert(operatorsAfterAdd.prim == 'Unit');
    });

    it('Remove a non existing operator should succeed', async () => {
        await wrapper.update_operators({
            argMichelson: `{Right (Pair "${alice.pkh}" "${bob.pkh}" ${tokenId})}`,
            as: alice.pkh,
        });
    });

    it('Remove an existing operator for another user should fail', async () => {
        await expectToThrow(async () => {
            await wrapper.update_operators({
                argMichelson: `{Right (Pair "${alice.pkh}" "${wrapper.address}" ${tokenId})}`,
                as: bob.pkh,
            });
        }, errors.CALLER_NOT_OWNER);
    });

    it('Add operator for another user should fail', async () => {
        await expectToThrow(async () => {
            await wrapper.update_operators({
                argMichelson: `{Left (Pair "${bob.pkh}" "${wrapper.address}" ${tokenId})}`,
                as: alice.pkh,
            });
        }, errors.CALLER_NOT_OWNER);
    });

    it('Remove an existing operator should succeed', async () => {
        const storage = await wrapper.getStorage();
        var initialOperators = await getValueFromBigMap(
            parseInt(storage.operator),
            exprMichelineToJson(
                `(Pair "${wrapper.address}" (Pair ${tokenId} "${alice.pkh}"))`
            ),
            exprMichelineToJson(`(pair address (pair nat address))'`)
        );
        assert(initialOperators.prim == 'Unit');
        await wrapper.update_operators({
            argMichelson: `{Right (Pair "${alice.pkh}" "${wrapper.address}" ${tokenId})}`,
            as: alice.pkh,
        });
        var operatorsAfterRemoval = await getValueFromBigMap(
            parseInt(storage.operator),
            exprMichelineToJson(
                `(Pair "${wrapper.address}" (Pair ${tokenId} "${alice.pkh}"))`
            ),
            exprMichelineToJson(`(pair address (pair nat address))'`)
        );
        assert(operatorsAfterRemoval == null);
    });
});

describe('Add permit', async () => {
    it('Add a permit with the wrong signature should fail', async () => {
        await expectToThrowMissigned(async () => {
            permit = await mkTransferPermit(
                alice,
                bob,
                wrapper.address,
                amount,
                tokenId,
                alicePermitNb
            );
            const argM = `(Pair "${alice.pubk}" (Pair "edsigu3QDtEZeSCX146136yQdJnyJDfuMRsDxiCgea3x7ty2RTwDdPpgioHWJUe86tgTCkeD2u16Az5wtNFDdjGyDpb7MiyU3fn" 0x${permit.hash}))`;
            await wrapper.permit({
                argMichelson: argM,
                as: bob.pkh,
            });
        }, errors.MISSIGNED);
    });

    it('Add a permit with the wrong hash should fail', async () => {
        await expectToThrowMissigned(async () => {
            permit = await mkTransferPermit(
                alice,
                bob,
                wrapper.address,
                amount,
                tokenId,
                alicePermitNb
            );
            const argM = `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x9aabe91d035d02ffb550bb9ea6fe19970f6fb41b5e69459a60b1ae401192a2dc))`;
            await wrapper.permit({
                argMichelson: argM,
                as: bob.pkh,
            });
        }, errors.MISSIGNED);
    });

    it('Add a permit with the wrong public key should fail', async () => {
        await expectToThrowMissigned(async () => {
            permit = await mkTransferPermit(
                alice,
                bob,
                wrapper.address,
                amount,
                tokenId,
                alicePermitNb
            );
            const argM = `(Pair "${bob.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;
            await wrapper.permit({
                argMichelson: argM,
                as: bob.pkh,
            });
        }, errors.MISSIGNED);
    });

    it('Add a permit with the good hash, signature and public key should succeed', async () => {
        permit = await mkTransferPermit(
            alice,
            bob,
            wrapper.address,
            amount,
            tokenId,
            alicePermitNb
        );
        const argM = `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;

        const storage = await wrapper.getStorage();
        var initialPermit = await getValueFromBigMap(
            parseInt(storage.permits),
            exprMichelineToJson(`"${alice.pkh}"`),
            exprMichelineToJson(`address'`)
        );
        assert(initialPermit == null);

        await wrapper.permit({
            argMichelson: argM,
            as: bob.pkh,
        });
        alicePermitNb++;

        var addedPermit = await getValueFromBigMap(
            parseInt(storage.permits),
            exprMichelineToJson(`"${alice.pkh}"`),
            exprMichelineToJson(`address'`)
        );
        assert(
            addedPermit.args.length == 3 &&
            addedPermit.prim == 'Pair' &&
            addedPermit.args[0].int == '' + alicePermitNb &&
            addedPermit.args[1].prim == 'None' &&
            addedPermit.args[2][0].prim == 'Elt' &&
            addedPermit.args[2][0].args[0].bytes == permit.hash &&
            addedPermit.args[2][0].args[1].prim == 'Pair' &&
            addedPermit.args[2][0].args[1].args[0].prim == 'Some' &&
            addedPermit.args[2][0].args[1].args[0].args[0].int == '31556952'
        );
    });

    it('Add a duplicated permit should succeed', async () => {
        const storage = await wrapper.getStorage();
        var initialPermit = await getValueFromBigMap(
            parseInt(storage.permits),
            exprMichelineToJson(`"${alice.pkh}"`),
            exprMichelineToJson(`address'`)
        );
        assert(
            initialPermit.args.length == 3 &&
            initialPermit.prim == 'Pair' &&
            initialPermit.args[0].int == '' + alicePermitNb &&
            initialPermit.args[1].prim == 'None' &&
            initialPermit.args[2][0].prim == 'Elt' &&
            initialPermit.args[2][0].args[0].bytes == permit.hash &&
            initialPermit.args[2][0].args[1].prim == 'Pair' &&
            initialPermit.args[2][0].args[1].args[0].prim == 'Some' &&
            initialPermit.args[2][0].args[1].args[0].args[0].int == '31556952'
        );

        permit = await mkTransferPermit(
            alice,
            bob,
            wrapper.address,
            amount,
            tokenId,
            alicePermitNb
        );
        const argM = `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;
        await wrapper.permit({
            argMichelson: argM,
            as: bob.pkh,
        });
        alicePermitNb++;

        var addedPermit = await getValueFromBigMap(
            parseInt(storage.permits),
            exprMichelineToJson(`"${alice.pkh}"`),
            exprMichelineToJson(`address'`)
        );
        assert(
            addedPermit.args.length == 3 &&
            addedPermit.prim == 'Pair' &&
            addedPermit.args[0].int == '' + alicePermitNb &&
            addedPermit.args[1].prim == 'None' &&
            addedPermit.args[2][0].prim == 'Elt' &&
            addedPermit.args[2][0].args[0].bytes == permit.hash &&
            addedPermit.args[2][0].args[1].prim == 'Pair' &&
            addedPermit.args[2][0].args[1].args[0].prim == 'Some' &&
            addedPermit.args[2][0].args[1].args[0].args[0].int == '31556952'
        );
    });

    it('Expired permit are removed when a new permit is added should succeed', async () => {
        const expiry = 1;
        const storage = await wrapper.getStorage();
        const now = new Date();
        if (isMockup()) setMockupNow(now);
        permit = await mkTransferPermit(
            alice,
            bob,
            wrapper.address,
            amount,
            tokenId,
            alicePermitNb
        );
        const argM = `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;
        await wrapper.permit({
            argMichelson: argM,
            as: bob.pkh,
        });

        const firstPermit = permit.hash;

        alicePermitNb++;

        var addedPermit = await getValueFromBigMap(
            parseInt(storage.permits),
            exprMichelineToJson(`"${alice.pkh}"`),
            exprMichelineToJson(`address'`)
        );
        assert(
            addedPermit.args.length == 3 &&
            addedPermit.prim == 'Pair' &&
            addedPermit.args[0].int == '' + alicePermitNb &&
            addedPermit.args[1].prim == 'None' &&
            addedPermit.args[2][0].prim == 'Elt' &&
            addedPermit.args[2][0].args[0].bytes == firstPermit &&
            addedPermit.args[2][0].args[1].prim == 'Pair' &&
            addedPermit.args[2][0].args[1].args[0].prim == 'Some' &&
            addedPermit.args[2][0].args[1].args[0].args[0].int == '31556952'
        );

        const argMExp = `(Pair (Some ${expiry}) (Some 0x${firstPermit}))`;

        await wrapper.set_expiry({
            argMichelson: argMExp,
            as: alice.pkh,
        });

        var expiryRes = await getValueFromBigMap(
            parseInt(storage.permits),
            exprMichelineToJson(`"${alice.pkh}"`),
            exprMichelineToJson(`address'`)
        );

        assert(
            expiryRes.args.length == 3 &&
            expiryRes.prim == 'Pair' &&
            expiryRes.args[0].int == '' + alicePermitNb &&
            expiryRes.args[1].prim == 'None' &&
            expiryRes.args[2][0].prim == 'Elt' &&
            expiryRes.args[2][0].args[0].bytes == firstPermit &&
            expiryRes.args[2][0].args[1].prim == 'Pair' &&
            expiryRes.args[2][0].args[1].args[0].prim == 'Some' &&
            expiryRes.args[2][0].args[1].args[0].args[0].int == '' + expiry
        );

        if (isMockup()) setMockupNow(new Date(Date.now() + 1100));

        permit = await mkTransferPermit(
            alice,
            carl,
            wrapper.address,
            amount,
            10,
            alicePermitNb
        );
        const argM2 = `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;
        await wrapper.permit({
            argMichelson: argM2,
            as: bob.pkh,
        });
        alicePermitNb++;

        var afterSecondPermitRes = await getValueFromBigMap(
            parseInt(storage.permits),
            exprMichelineToJson(`"${alice.pkh}"`),
            exprMichelineToJson(`address'`)
        );
        assert(
            afterSecondPermitRes.args.length == 3 &&
            afterSecondPermitRes.prim == 'Pair' &&
            afterSecondPermitRes.args[0].int == '' + alicePermitNb &&
            afterSecondPermitRes.args[1].prim == 'None' &&
            afterSecondPermitRes.args[2].length == 1 &&
            afterSecondPermitRes.args[2][0].prim == 'Elt' &&
            afterSecondPermitRes.args[2][0].args[0].bytes == permit.hash &&
            afterSecondPermitRes.args[2][0].args[1].prim == 'Pair' &&
            afterSecondPermitRes.args[2][0].args[1].args[0].prim == 'Some' &&
            afterSecondPermitRes.args[2][0].args[1].args[0].args[0].int == '31556952'
        );
    });
});

describe('Transfers', async () => {
    it('Transfer a token not owned should fail', async () => {
        await expectToThrow(async () => {
            await wrapper.transfer({
                arg: {
                    txs: [[alice.pkh, [[bob.pkh, 666, 1]]]],
                },
                as: alice.pkh,
            });
        }, errors.FA2_NOT_OPERATOR);
    });

    it('Transfer a token from another user without a permit or an operator should fail', async () => {
        await expectToThrow(async () => {
            await wrapper.transfer({
                arg: {
                    txs: [[alice.pkh, [[bob.pkh, tokenId, 1]]]],
                },
                as: bob.pkh,
            });
        }, errors.FA2_NOT_OPERATOR);
    });

    it('Transfer more tokens that owned should fail', async () => {
        await expectToThrow(async () => {
            await wrapper.transfer({
                arg: {
                    txs: [[alice.pkh, [[bob.pkh, tokenId, 99999999999999]]]],
                },
                as: alice.pkh,
            });
        }, errors.FA2_INSUFFICIENT_BALANCE);
    });

    it('Transfer tokens without operator and an expired permit should fail', async () => {
        if (isMockup()) setMockupNow(new Date());

        permit = await mkTransferPermit(
            alice,
            bob,
            wrapper.address,
            amount,
            tokenId,
            alicePermitNb
        );
        const argM = `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;
        await wrapper.permit({
            argMichelson: argM,
            as: bob.pkh,
        });

        alicePermitNb++;

        const argMExp = `(Pair (Some 1) (Some 0x${permit.hash}))`;

        await wrapper.set_expiry({
            argMichelson: argMExp,
            as: alice.pkh,
        });

        if (isMockup()) setMockupNow(new Date(Date.now() + 1100));

        await expectToThrow(async () => {
            await wrapper.transfer({
                arg: {
                    txs: [[alice.pkh, [[bob.pkh, tokenId, amount]]]],
                },
                as: carl.pkh,
            });
        }, errors.EXPIRED_PERMIT);
    });

    it('Transfer tokens with an operator and with permit (permit not consumed) should succeed', async () => {
        const storage = await wrapper.getStorage();

        permit = await mkTransferPermit(
            alice,
            carl,
            wrapper.address,
            amount,
            tokenId,
            alicePermitNb
        );
        const argM = `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;
        await wrapper.permit({
            argMichelson: argM,
            as: carl.pkh,
        });

        alicePermitNb++;

        var initState = await getValueFromBigMap(
            parseInt(storage.permits),
            exprMichelineToJson(`"${alice.pkh}"`),
            exprMichelineToJson(`address'`)
        );

        const permits_nb = initState.args[2].length

        await wrapper.update_operators({
            argMichelson: `{Left (Pair "${alice.pkh}" "${carl.pkh}" ${tokenId})}`,
            as: alice.pkh,
        });

        var aliceBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${alice.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(parseInt(aliceBalances.int) == parseInt(amount*1_000_000) * 3);
        var bobBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${bob.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(parseInt(bobBalances.int) == parseInt(amount*1_000_000) * 2);

        await wrapper.transfer({
            arg: {
                txs: [[alice.pkh, [[bob.pkh, tokenId, amount]]]],
            },
            as: carl.pkh,
        });

        var addedPermit = await getValueFromBigMap(
            parseInt(storage.permits),
            exprMichelineToJson(`"${alice.pkh}"`),
            exprMichelineToJson(`address'`)
        );

        assert(
            permits_nb == addedPermit.args[2].length &&
            JSON.stringify(initState.args[2]) == JSON.stringify(addedPermit.args[2])
        );

        var alicePostTransferBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${alice.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(parseInt(alicePostTransferBalances.int) == parseInt(amount*1_000_000) * 3 - parseInt(amount));
        var bobPostTransferBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${bob.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(parseInt(bobPostTransferBalances.int) == parseInt(amount*1_000_000) * 2 + parseInt(amount));
    });

    it('Transfer tokens without an operator and a valid permit (permit consumed)', async () => {
        // permit to transfer from payer to usdsReceiver
        const storage = await wrapper.getStorage();

        permit = await mkTransferPermit(
            alice,
            bob,
            wrapper.address,
            amount,
            tokenId,
            alicePermitNb
        );
        const argM = `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;
        await wrapper.permit({
            argMichelson: argM,
            as: alice.pkh,
        });

        var initState = await getValueFromBigMap(
            parseInt(storage.permits),
            exprMichelineToJson(`"${alice.pkh}"`),
            exprMichelineToJson(`address'`)
        );
        const permits_nb = initState.args[2].length

        alicePermitNb++;

        var aliceBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${alice.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(parseInt(aliceBalances.int) == parseInt(amount*1_000_000) * 3 - parseInt(amount));
        var bobBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${bob.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(parseInt(bobBalances.int) == parseInt(amount*1_000_000) * 2 + parseInt(amount));

        await wrapper.update_operators({
            argMichelson: `{Right (Pair "${alice.pkh}" "${bob.pkh}" ${tokenId})}`,
            as: alice.pkh,
        });

        await wrapper.transfer({
            arg: {
                txs: [[alice.pkh, [[bob.pkh, tokenId, amount]]]],
            },
            as: bob.pkh,
        });

        var addedPermit = await getValueFromBigMap(
            parseInt(storage.permits),
            exprMichelineToJson(`"${alice.pkh}"`),
            exprMichelineToJson(`address'`)
        );

        assert(
            permits_nb > addedPermit.args[2].length
        );

        var alicePostTransferBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${alice.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(parseInt(alicePostTransferBalances.int) == parseInt(amount*1_000_000) * 3 - parseInt(amount) * 2);
        var bobPostTransferBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${bob.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(parseInt(bobPostTransferBalances.int) == parseInt(amount*1_000_000) * 2 + parseInt(amount) * 2);
    });
});

describe('Transfers gasless ', async () => {
    it('Transfer a token not owned should fail', async () => {
        await expectToThrowMissigned(async () => {
            const testTokenId = 666
            permit = await mkTransferGaslessArgs(
                alice,
                bob,
                wrapper.address,
                amount,
                tokenId,
                alicePermitNb
            );
            await wrapper.transfer_gasless({
                argMichelson: `{ Pair { Pair "${alice.pkh}" { Pair "${bob.pkh}" (Pair ${testTokenId} ${amount}) } } (Pair "${alice.pubk}" "${permit.sig.prefixSig}" )}`,
                as: alice.pkh,
            });
        }, errors.MISSIGNED);
    });

    it('Transfer a token from another user with wrong a permit should fail', async () => {
        await expectToThrowMissigned(async () => {
            const testTokenId = 1
            permit = await mkTransferGaslessArgs(
                alice,
                bob,
                wrapper.address,
                amount,
                tokenId,
                alicePermitNb
            );
            await wrapper.transfer_gasless({
                argMichelson: `{ Pair { Pair "${alice.pkh}" { Pair "${bob.pkh}" (Pair ${testTokenId} ${amount}) } } (Pair "${bob.pubk}" "${permit.sig.prefixSig}" )}`,
                as: bob.pkh,
            });
        }, errors.MISSIGNED);
    });

    it('Transfer more tokens that owned should fail', async () => {
        await expectToThrowMissigned(async () => {
            const testTokenId = 1
            permit = await mkTransferGaslessArgs(
                alice,
                bob,
                wrapper.address,
                666666,
                testTokenId,
                alicePermitNb
            );
            await wrapper.transfer_gasless({
                argMichelson: `{ Pair { Pair "${alice.pkh}" { Pair "${bob.pkh}" (Pair ${testTokenId} ${amount}) } } (Pair "${bob.pubk}" "${permit.sig.prefixSig}" )}`,
                as: alice.pkh,
            });
        }, errors.MISSIGNED);
    });


    it('Transfer tokens with permit should succeed', async () => {
        const storage = await wrapper.getStorage();

        permit = await mkTransferGaslessArgs(
            alice,
            bob,
            wrapper.address,
            amount*2,
            tokenId,
            alicePermitNb
        );

        alicePermitNb++;

        var aliceBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${alice.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(parseInt(aliceBalances.int) == parseInt(amount*1_000_000) * 3 - parseInt(amount) * 2);
        var bobBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${bob.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(parseInt(bobBalances.int) == parseInt(amount*1_000_000) * 2 + parseInt(amount) * 2);

        await wrapper.transfer_gasless({
            argMichelson: `{ Pair { Pair "${alice.pkh}" { Pair "${bob.pkh}" (Pair ${tokenId} ${parseInt(amount)*2}) } } (Pair "${alice.pubk}" "${permit.sig.prefixSig}" )}`,
            as: bob.pkh,
        });

        var addedPermit = await getValueFromBigMap(
            parseInt(storage.permits),
            exprMichelineToJson(`"${alice.pkh}"`),
            exprMichelineToJson(`address'`)
        );

        assert(
            "" + alicePermitNb == addedPermit.args[0].int
        );

        var alicePostTransferBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${alice.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(parseInt(alicePostTransferBalances.int) == parseInt(amount*1_000_000) * 3 - parseInt(amount) * 4);
        var bobPostTransferBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${bob.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(parseInt(bobPostTransferBalances.int) == parseInt(amount*1_000_000) * 2 + parseInt(amount) * 4);
    });
});

describe('Set metadata', async () => {
    it('Set metadata with empty content should succeed', async () => {
        const argM = `(Pair "" 0x)`;
        const storage = await wrapper.getStorage();
        await wrapper.set_metadata({
            argMichelson: argM,
            as: alice.pkh,
        });
        var metadata = await getValueFromBigMap(
            parseInt(storage.metadata),
            exprMichelineToJson(`""`),
            exprMichelineToJson(`string'`)
        );
        assert(metadata.bytes == '');
    });

    it('Set metadata called by not owner should fail', async () => {
        await expectToThrow(async () => {
            const argM = `(Pair "key" 0x)`;
            await wrapper.set_metadata({
                argMichelson: argM,
                as: bob.pkh,
            });
        }, errors.INVALID_CALLER);
    });

    it('Set metadata with valid content should succeed', async () => {
        const bytes =
            '0x05070707070a00000016016a5569553c34c4bfe352ad21740dea4e2faad3da000a00000004f5f466ab070700000a000000209aabe91d035d02ffb550bb9ea6fe19970f6fb41b5e69459a60b1ae401192a2dc';
        const argM = `(Pair "" ${bytes})`;
        const storage = await wrapper.getStorage();

        await wrapper.set_metadata({
            argMichelson: argM,
            as: alice.pkh,
        });

        var metadata = await getValueFromBigMap(
            parseInt(storage.metadata),
            exprMichelineToJson(`""`),
            exprMichelineToJson(`string'`)
        );
        assert('0x' + metadata.bytes == bytes);
    });
});

describe('Set token metadata', async () => {
    it('Set token metadata with empty content should succeed', async () => {
        const argM = `0x`;
        const storage = await wrapper.getStorage();
        await wrapper.set_token_metadata({
            argMichelson: argM,
            as: alice.pkh,
        });
        var metadata = await getValueFromBigMap(
            parseInt(storage.token_metadata),
            exprMichelineToJson(`0`),
            exprMichelineToJson(`nat`)
        );
        assert(
            metadata.prim == 'Pair' &&
            metadata.args[0].int == 0 &&
            metadata.args[1][0].args[0].string == '' &&
            metadata.args[1][0].args[1].bytes == ''
        );
    });

    it('Set token metadata called by not owner should fail', async () => {
        await expectToThrow(async () => {
            const argM = `0x`;
            await wrapper.set_token_metadata({
                argMichelson: argM,
                as: bob.pkh,
            });
        }, errors.INVALID_CALLER);
    });

    it('Set token metadata with valid content should succeed', async () => {
        const bytes =
            '05070707070a00000016016a5569553c34c4bfe352ad21740dea4e2faad3da000a00000004f5f466ab070700000a000000209aabe91d035d02ffb550bb9ea6fe19970f6fb41b5e69459a60b1ae401192a2dc';
        const argM = `0x${bytes}`;
        const storage = await wrapper.getStorage();

        await wrapper.set_token_metadata({
            argMichelson: argM,
            as: alice.pkh,
        });

        var metadata = await getValueFromBigMap(
            parseInt(storage.token_metadata),
            exprMichelineToJson(`0`),
            exprMichelineToJson(`nat`)
        );
        assert(
            metadata.prim == 'Pair' &&
            metadata.args[0].int == 0 &&
            metadata.args[1][0].args[0].string == '' &&
            metadata.args[1][0].args[1].bytes == bytes
        );
    });
});

describe('Set expiry', async () => {

    it('Set global expiry with too big value should fail', async () => {
        const argMExp = `(Pair (Some 999999999999999999999999999999999999999) (None))`;
        await expectToThrow(async () => {
            await wrapper.set_expiry({
                argMichelson: argMExp,
                as: alice.pkh,
            });
        }, errors.EXPIRY_TOO_BIG);
    });

    it('Set expiry for an existing permit with too big value should fail', async () => {
        await expectToThrow(async () => {
            const testAmount = 11;
            permit = await mkTransferPermit(
                alice,
                bob,
                wrapper.address,
                testAmount,
                tokenId,
                alicePermitNb
            );
            const argM = `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;
            await wrapper.permit({
                argMichelson: argM,
                as: alice.pkh,
            });
            alicePermitNb++;
            const argMExp = `(Pair (Some 999999999999999999999999999999999999999) (Some 0x${permit.hash}))`;

            await wrapper.set_expiry({
                argMichelson: argMExp,
                as: bob.pkh,
            });
        }, errors.EXPIRY_TOO_BIG);
    });

    it('Set expiry with 0 (permit get deleted) should succeed', async () => {
        const testAmount = testAmount_2;
        const storage = await wrapper.getStorage();
        permit = await mkTransferPermit(
            carl,
            alice,
            wrapper.address,
            testAmount,
            tokenId,
            carlPermitNb
        );
        const argM = `(Pair "${carl.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;

        var initialPermit = await getValueFromBigMap(
            parseInt(storage.permits),
            exprMichelineToJson(`"${carl.pkh}"`),
            exprMichelineToJson(`address'`)
        );
        assert(initialPermit == null);

        await wrapper.permit({
            argMichelson: argM,
            as: alice.pkh,
        });
        carlPermitNb++;

        var addedPermit = await getValueFromBigMap(
            parseInt(storage.permits),
            exprMichelineToJson(`"${carl.pkh}"`),
            exprMichelineToJson(`address'`)
        );

        assert(
            addedPermit.args.length == 3 &&
            addedPermit.prim == 'Pair' &&
            addedPermit.args[0].int == '' + carlPermitNb &&
            addedPermit.args[1].prim == 'None' &&
            addedPermit.args[2].length == 1 &&
            addedPermit.args[2][0].prim == 'Elt' &&
            addedPermit.args[2][0].args[0].bytes == permit.hash &&
            addedPermit.args[2][0].args[1].prim == 'Pair' &&
            addedPermit.args[2][0].args[1].args[0].prim == 'Some' &&
            addedPermit.args[2][0].args[1].args[0].args[0].int == '31556952'
        );

        const argMExp = `(Pair (Some 0) (Some 0x${permit.hash}))`;

        await wrapper.set_expiry({
            argMichelson: argMExp,
            as: carl.pkh,
        });

        var finalPermit = await getValueFromBigMap(
            parseInt(storage.permits),
            exprMichelineToJson(`"${carl.pkh}"`),
            exprMichelineToJson(`address'`)
        );

        assert(
            finalPermit.args.length == 3 &&
            finalPermit.prim == 'Pair' &&
            finalPermit.args[0].int == '' + carlPermitNb &&
            finalPermit.args[1].prim == 'None' &&
            finalPermit.args[2].length == 0
        );

    });

    it('Set expiry with a correct value should succeed', async () => {
        const testAmount = 11;
        const expiry = 8;
        const storage = await wrapper.getStorage();

        permit = await mkTransferPermit(
            carl,
            bob,
            wrapper.address,
            testAmount,
            tokenId,
            carlPermitNb
        );
        const argM = `(Pair "${carl.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;

        var initialPermit = await getValueFromBigMap(
            parseInt(storage.permits),
            exprMichelineToJson(`"${carl.pkh}"`),
            exprMichelineToJson(`address'`)
        );
        assert(
            initialPermit.args.length == 3 &&
            initialPermit.prim == 'Pair' &&
            initialPermit.args[0].int == '' + carlPermitNb &&
            initialPermit.args[1].prim == 'None' &&
            initialPermit.args[2].length == 0
        );
        await wrapper.permit({
            argMichelson: argM,
            as: alice.pkh,
        });

        carlPermitNb++;

        var createdAt = await await getValueFromBigMap(
            parseInt(storage.permits),
            exprMichelineToJson(`"${carl.pkh}"`),
            exprMichelineToJson(`address'`)
        );

        assert(
            createdAt.args.length == 3 &&
            createdAt.prim == 'Pair' &&
            createdAt.args[0].int == '' + carlPermitNb &&
            createdAt.args[1].prim == 'None' &&
            createdAt.args[2].length == 1 &&
            createdAt.args[2][0].prim == 'Elt' &&
            createdAt.args[2][0].args[0].bytes == permit.hash &&
            createdAt.args[2][0].args[1].prim == 'Pair' &&
            createdAt.args[2][0].args[1].args[0].prim == 'Some' &&
            createdAt.args[2][0].args[1].args[0].args[0].int == '31556952'
        );

        var creationDate = createdAt.args[2][0].args[1].args[1].string;

        const argMExp = `(Pair (Some ${expiry}) (Some 0x${permit.hash}))`;

        await wrapper.set_expiry({
            argMichelson: argMExp,
            as: carl.pkh,
        });

        var addedPermit = await getValueFromBigMap(
            parseInt(storage.permits),
            exprMichelineToJson(`"${carl.pkh}"`),
            exprMichelineToJson(`address'`)
        );
        assert(
            addedPermit.args.length == 3 &&
            addedPermit.prim == 'Pair' &&
            addedPermit.args[0].int == '' + carlPermitNb &&
            addedPermit.args[1].prim == 'None' &&
            addedPermit.args[2].length == 1 &&
            addedPermit.args[2][0].prim == 'Elt' &&
            addedPermit.args[2][0].args[0].bytes == permit.hash &&
            addedPermit.args[2][0].args[1].prim == 'Pair' &&
            addedPermit.args[2][0].args[1].args[0].prim == 'Some' &&
            addedPermit.args[2][0].args[1].args[0].args[0].int == expiry &&
            addedPermit.args[2][0].args[1].args[1].string == creationDate
        );
    });
});

describe('Burn', async () => {
    it('Burn without tokens should fail', async () => {
        await expectToThrow(async () => {
            await wrapper.unwrap({
                argMichelson: `1`,
                as: daniel.pkh,
            });
        }, errors.ASSET_NOT_FOUND);
    });

    it('Burn tokens with not enough tokens should fail', async () => {
        await expectToThrow(async () => {
            await wrapper.unwrap({
                argMichelson: `66666666666666666666`,
                as: alice.pkh,
            });
        }, errors.FA2_INSUFFICIENT_BALANCE);
    });

    it('Burn tokens with enough tokens should succeed', async () => {
        const storage = await wrapper.getStorage();
        var aliceTransferBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${alice.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(parseInt(aliceTransferBalances.int) == parseInt(amount*1_000_000) * 3 - parseInt(amount) * 4);

        await wrapper.unwrap({
            argMichelson: `${burnAmount}`,
            as: alice.pkh,
        });

        var alicePostTransferBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${alice.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(parseInt(alicePostTransferBalances.int) == parseInt(amount*1_000_000) * 3 - parseInt(amount) * 4 - burnAmount);
    });

    it('Burn tokens with enough tokens and with operator a second time should succeed', async () => {
        const storage = await wrapper.getStorage();
        var aliceTransferBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${alice.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(parseInt(aliceTransferBalances.int) == parseInt(amount*1_000_000) * 3 - parseInt(amount) * 4 - burnAmount);

        await wrapper.unwrap({
            argMichelson: `${burnAmount}`,
            as: alice.pkh,
        });

        var alicePostTransferBalances = await getValueFromBigMap(
            parseInt(storage.ledger),
            exprMichelineToJson(`(Pair ${tokenId} "${alice.pkh}")`),
            exprMichelineToJson(`(pair nat address))'`)
        );
        assert(parseInt(alicePostTransferBalances.int) == parseInt(amount*1_000_000) * 3 - parseInt(amount) * 4 - burnAmount*2);
    });
});

describe('Pause', async () => {
    it('Set pause should succeed', async () => {
        await wrapper.pause({
            as: alice.pkh,
        });
        const storage = await wrapper.getStorage();
        assert(storage.paused == true);
    });

    it('Minting is not possible when contract is paused should fail', async () => {
        await expectToThrow(async () => {
            await wrapper.wrap({
                arg: {
                    iowner: alice.pkh,
                    iamount: amount
                },
                as: alice.pkh,
            });
        }, errors.CONTRACT_PAUSED);
    });

    it('Update operators is not possible when contract is paused should fail', async () => {
        await expectToThrow(async () => {
            await wrapper.update_operators({
                argMichelson: `{Left (Pair "${alice.pkh}" "${bob.pkh}" ${tokenId})}`,
                as: alice.pkh,
            });
        }, errors.CONTRACT_PAUSED);
    });

    it('Add permit is not possible when contract is paused should fail', async () => {
        await expectToThrow(async () => {
            permit = await mkTransferPermit(
                alice,
                bob,
                wrapper.address,
                amount,
                tokenId,
                alicePermitNb
            );
            const argM = `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;

            await wrapper.permit({
                argMichelson: argM,
                as: bob.pkh,
            });
        }, errors.CONTRACT_PAUSED);
    });

    it('Transfer is not possible when contract is paused should fail', async () => {
        await expectToThrow(async () => {
            await wrapper.transfer({
                arg: {
                    txs: [[alice.pkh, [[bob.pkh, tokenId, 666]]]],
                },
                as: alice.pkh,
            });
        }, errors.CONTRACT_PAUSED);
    });

    it('Set metadata is not possible when contract is paused should fail', async () => {
        await expectToThrow(async () => {
            const bytes =
                '0x05070707070a00000016016a5569553c34c4bfe352ad21740dea4e2faad3da000a00000004f5f466ab070700000a000000209aabe91d035d02ffb550bb9ea6fe19970f6fb41b5e69459a60b1ae401192a2dc';
            const argM = `(Pair "" ${bytes})`;
            await wrapper.set_metadata({
                argMichelson: argM,
                as: alice.pkh,
            });
        }, errors.CONTRACT_PAUSED);
    });

    it('Set expiry is not possible when contract is paused should fail', async () => {
        const expiry = 8;
        permit = await mkTransferPermit(
            alice,
            bob,
            wrapper.address,
            amount,
            tokenId,
            alicePermitNb
        );
        const argMExp = `(Pair (Some ${expiry}) (Some 0x${permit.hash}))`;

        await expectToThrow(async () => {
            await wrapper.set_expiry({
                argMichelson: argMExp,
                as: alice.pkh,
            });
        }, errors.CONTRACT_PAUSED);
    });

    it('Burn is not possible when contract is paused should fail', async () => {
        await expectToThrow(async () => {
            await wrapper.unwrap({
                argMichelson: `666`,
                as: alice.pkh,
            });
        }, errors.CONTRACT_PAUSED);
    });

    it('Transfer ownership when contract is paused should succeed', async () => {
        let storage = await wrapper.getStorage();
        assert(storage.owner == alice.pkh);
        await wrapper.declare_ownership({
            argMichelson: `"${alice.pkh}"`,
            as: alice.pkh,
        });
        storage = await wrapper.getStorage();
        assert(storage.owner == alice.pkh);
    });
});

describe('Transfer ownership', async () => {
    it('Transfer ownership as non owner should fail', async () => {
        await wrapper.unpause({
            as: alice.pkh,
        });
        await expectToThrow(async () => {
            await wrapper.declare_ownership({
                argMichelson: `"${bob.pkh}"`,
                as: bob.pkh,
            });
        }, errors.INVALID_CALLER);
    });

    it('Transfer ownership as owner should succeed', async () => {
        let storage = await wrapper.getStorage();
        assert(storage.owner == alice.pkh);
        await wrapper.declare_ownership({
            argMichelson: `"${bob.pkh}"`,
            as: alice.pkh,
        });
        await wrapper.claim_ownership({
            as: bob.pkh,
        });
        storage = await wrapper.getStorage();
        assert(storage.owner == bob.pkh);
    });
});
