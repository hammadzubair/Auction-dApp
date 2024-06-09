import { useEffect, useState } from "preact/hooks";
import { Blockfrost, Lucid, Constr, Data, fromText } from "lucid/mod.ts";

import { Input } from "~/components/Input.tsx";
import { Button } from "~/components/Button.tsx";
import { AppliedValidators, applyParams, Validators } from "~/utils.ts";

export interface AuctionProps {
  validators: Validators;
}

export default function Auction({ validators }: AuctionProps) {
  const [lucid, setLucid] = useState<Lucid | null>(null);
  const [blockfrostAPIKey, setBlockfrostAPIKey] = useState<string>("");
  const [object, setObject] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");
  const [parameterizedContracts, setParameterizedContracts] = useState<AppliedValidators | null>(null);
  const [bidAmount, setBidAmount] = useState<string | undefined>();
  const [auctionTxHash, setAuctionTxHash] = useState<string | undefined>(undefined);
  const [waitingAuctionTx, setWaitingAuctionTx] = useState<boolean>(false);
  const [bidTxHash, setBidTxHash] = useState<string | undefined>(undefined);
  const [waitingBidTx, setWaitingBidTx] = useState<boolean>(false);
  const [withdrawTxHash, setWithdrawTxHash] = useState<string | undefined>(undefined);
  const [waitingWithdrawTx, setWaitingWithdrawTx] = useState<boolean>(false);
  const [closeTxHash, setCloseTxHash] = useState<string | undefined>(undefined);
  const [waitingCloseTx, setWaitingCloseTx] = useState<boolean>(false);

  const getDefaultDeadline = () => {
    const currentTime = Math.floor(Date.now() / 1000);
    return (currentTime + 300).toString(); // 5 minutes from now
  };

  const setupLucid = async (e: Event) => {
    e.preventDefault();

    try {
      if (!window.cardano || !window.cardano.eternl) {
        throw new Error("Eternl wallet extension is not available. Please ensure it is installed and enabled.");
      }

      const lucidInstance = await Lucid.new(
        new Blockfrost(
          "https://cardano-preview.blockfrost.io/api/v0",
          blockfrostAPIKey
        ),
        "Preview"
      );

      const api = await window.cardano.eternl.enable();
      if (!api.getUtxos) {
        throw new Error("Eternl wallet API does not support getUtxos method.");
      }

      lucidInstance.selectWallet(api);
      setLucid(lucidInstance);
      console.log('Lucid initialized:', lucidInstance);
    } catch (error) {
      console.error('Failed to initialize Lucid:', error.message);
    }
  };

  useEffect(() => {
    setDeadline(getDefaultDeadline());
  }, []);

  const submitAuctionDetails = async (e: Event) => {
    e.preventDefault();

    if (!lucid) {
      console.error('Lucid is not initialized');
      return;
    }

    const contracts = applyParams(
      object,
      parseInt(deadline),
      validators,
      lucid
    );

    setParameterizedContracts(contracts);
    console.log('Auction details submitted:', contracts);
  };

  const createAuction = async (e: Event) => {
    e.preventDefault();

    if (!lucid) {
      console.error('Lucid is not initialized');
      return;
    }

    setWaitingAuctionTx(true);
    console.log('Creating auction with details:', { object, deadline });

    try {
      const auctionDatum = Data.to(
        new Constr(0, [
          fromText(object),
          BigInt(deadline),
          new Constr(0, []), // NOT_STARTED status
          new Constr(0, []), // Empty bidder
          BigInt(0), // Starting amount
        ])
      );
      console.log('Auction datum created:', auctionDatum);

      const utxos = await lucid.wallet.getUtxos();
      console.log('Fetched UTXOs:', utxos);

      if (!utxos || utxos.length === 0) {
        throw new Error("No UTXOs available in the wallet. Please ensure the wallet has sufficient funds.");
      }

      const utxo = utxos[0];
      console.log('Using UTXO:', utxo);

      const tx = await lucid
        .newTx()
        .collectFrom([utxo])
        .payToContract(parameterizedContracts!.auctionAddress, { inline: auctionDatum }, { lovelace: BigInt(1000000) }) // Assuming starting bid is 1 ADA
        .complete();
      console.log('Transaction constructed:', tx);

      const txSigned = await tx.sign().complete();
      console.log('Transaction signed:', txSigned);

      const txHash = await txSigned.submit();
      console.log('Transaction submitted:', txHash);

      const success = await lucid.awaitTx(txHash);
      console.log('Transaction success:', success);

      setTimeout(() => {
        setWaitingAuctionTx(false);

        if (success) {
          setAuctionTxHash(txHash);
        }
      }, 3000);
    } catch (error) {
      console.error('Error creating auction:', error);
      setWaitingAuctionTx(false);
    }
  };

  const startAuction = async (e: Event) => {
    e.preventDefault();

    if (!lucid) {
      console.error('Lucid is not initialized');
      return;
    }

    setWaitingAuctionTx(true);
    console.log('Starting auction with details:', { object, deadline });

    try {
      const startDatum = Data.to(
        new Constr(1, [
          fromText(object),
          BigInt(deadline),
          new Constr(1, []), // STARTED status
          new Constr(1, []), // Initial bidder is seller
          BigInt(1000000), // Starting amount is 1 ADA
        ])
      );
      console.log('Start datum created:', startDatum);

      const utxos = await lucid.wallet.getUtxos();
      console.log('Fetched UTXOs:', utxos);

      if (!utxos || utxos.length === 0) {
        throw new Error("No UTXOs available in the wallet. Please ensure the wallet has sufficient funds.");
      }

      const utxo = utxos[0];
      console.log('Using UTXO:', utxo);

      const tx = await lucid
        .newTx()
        .collectFrom([utxo])
        .payToContract(parameterizedContracts!.auctionAddress, { inline: startDatum }, { lovelace: BigInt(1000000) })
        .complete();
      console.log('Transaction constructed:', tx);

      const txSigned = await tx.sign().complete();
      console.log('Transaction signed:', txSigned);

      const txHash = await txSigned.submit();
      console.log('Transaction submitted:', txHash);

      const success = await lucid.awaitTx(txHash);
      console.log('Transaction success:', success);

      setTimeout(() => {
        setWaitingAuctionTx(false);

        if (success) {
          setAuctionTxHash(txHash);
        }
      }, 3000);
    } catch (error) {
      console.error('Error starting auction:', error);
      setWaitingAuctionTx(false);
    }
  };

  const placeBid = async (e: Event) => {
    e.preventDefault();

    if (!lucid) {
      console.error('Lucid is not initialized');
      return;
    }

    setWaitingBidTx(true);
    console.log('Placing bid with amount:', bidAmount);

    try {
      const lovelace = Number(bidAmount) * 1000000;
      console.log('Lovelace calculated:', lovelace);

      const bidDatum = Data.to(
        new Constr(1, [
          fromText(object),
          BigInt(deadline),
          new Constr(1, []), // STARTED status
          new Constr(1, []), // Current bidder
          BigInt(lovelace), // Bid amount
        ])
      );
      console.log('Bid datum created:', bidDatum);

      const utxos = await lucid.wallet.getUtxos();
      console.log('Fetched UTXOs:', utxos);

      if (!utxos || utxos.length === 0) {
        throw new Error("No UTXOs available in the wallet. Please ensure the wallet has sufficient funds.");
      }

      const utxo = utxos[0];
      console.log('Using UTXO:', utxo);

      const tx = await lucid
        .newTx()
        .collectFrom([utxo])
        .payToContract(parameterizedContracts!.auctionAddress, { inline: bidDatum }, { lovelace: BigInt(lovelace) })
        .complete();
      console.log('Transaction constructed:', tx);

      const txSigned = await tx.sign().complete();
      console.log('Transaction signed:', txSigned);

      const txHash = await txSigned.submit();
      console.log('Transaction submitted:', txHash);

      const success = await lucid.awaitTx(txHash);
      console.log('Transaction success:', success);

      setTimeout(() => {
        setWaitingBidTx(false);

        if (success) {
          setBidTxHash(txHash);
        }
      }, 3000);
    } catch (error) {
      console.error('Error placing bid:', error);
      setWaitingBidTx(false);
    }
  };

  const withdrawBid = async (e: Event) => {
    e.preventDefault();

    if (!lucid) {
      console.error('Lucid is not initialized');
      return;
    }

    setWaitingWithdrawTx(true);
    console.log('Withdrawing bid');

    try {
      const withdrawDatum = Data.to(
        new Constr(2, [
          fromText(object),
          BigInt(deadline),
          new Constr(2, []), // OUTBID status
          new Constr(2, []), // Withdraw bidder
          BigInt(bidAmount) * 1000000, // Withdraw amount
        ])
      );
      console.log('Withdraw datum created:', withdrawDatum);

      const utxos = await lucid.wallet.getUtxos();
      console.log('Fetched UTXOs:', utxos);

      if (!utxos || utxos.length === 0) {
        throw new Error("No UTXOs available in the wallet. Please ensure the wallet has sufficient funds.");
      }

      const utxo = utxos[0];
      console.log('Using UTXO:', utxo);

      const tx = await lucid
        .newTx()
        .collectFrom([utxo])
        .payToContract(parameterizedContracts!.auctionAddress, { inline: withdrawDatum })
        .complete();
      console.log('Transaction constructed:', tx);

      const txSigned = await tx.sign().complete();
      console.log('Transaction signed:', txSigned);

      const txHash = await txSigned.submit();
      console.log('Transaction submitted:', txHash);

      const success = await lucid.awaitTx(txHash);
      console.log('Transaction success:', success);

      setTimeout(() => {
        setWaitingWithdrawTx(false);

        if (success) {
          setWithdrawTxHash(txHash);
        }
      }, 3000);
    } catch (error) {
      console.error('Error withdrawing bid:', error);
      setWaitingWithdrawTx(false);
    }
  };

  const closeAuction = async (e: Event) => {
    e.preventDefault();

    if (!lucid) {
      console.error('Lucid is not initialized');
      return;
    }

    setWaitingCloseTx(true);
    console.log('Closing auction');

    try {
      const closeDatum = Data.to(
        new Constr(3, [
          fromText(object),
          BigInt(deadline),
          new Constr(3, []), // ENDED status
          new Constr(3, []), // Winning bidder
          BigInt(bidAmount) * 1000000, // Final bid amount
        ])
      );
      console.log('Close datum created:', closeDatum);

      const utxos = await lucid.wallet.getUtxos();
      console.log('Fetched UTXOs:', utxos);

      if (!utxos || utxos.length === 0) {
        throw new Error("No UTXOs available in the wallet. Please ensure the wallet has sufficient funds.");
      }

      const utxo = utxos[0];
      console.log('Using UTXO:', utxo);

      const tx = await lucid
        .newTx()
        .collectFrom([utxo])
        .payToContract(parameterizedContracts!.auctionAddress, { inline: closeDatum })
        .complete();
      console.log('Transaction constructed:', tx);

      const txSigned = await tx.sign().complete();
      console.log('Transaction signed:', txSigned);

      const txHash = await txSigned.submit();
      console.log('Transaction submitted:', txHash);

      const success = await lucid.awaitTx(txHash);
      console.log('Transaction success:', success);

      setTimeout(() => {
        setWaitingCloseTx(false);

        if (success) {
          setCloseTxHash(txHash);
        }
      }, 3000);
    } catch (error) {
      console.error('Error closing auction:', error);
      setWaitingCloseTx(false);
    }
  };

  return (
    <div>
      {!lucid ? (
        <form class="mt-10 grid grid-cols-1 gap-y-8" onSubmit={setupLucid}>
          <Input
            type="password"
            id="blockfrostAPIKey"
            onInput={(e) => setBlockfrostAPIKey(e.currentTarget.value)}
          >
            Blockfrost API Key
          </Input>

          <Button type="submit">Setup Lucid</Button>
        </form>
      ) : (
        <>
          {!parameterizedContracts ? (
            <form class="mt-10 grid grid-cols-1 gap-y-8" onSubmit={submitAuctionDetails}>
              <Input
                type="text"
                name="object"
                id="object"
                value={object}
                onInput={(e) => setObject(e.currentTarget.value)}
              >
                Object
              </Input>
              <Input
                type="text"
                name="deadline"
                id="deadline"
                value={deadline}
                onInput={(e) => setDeadline(e.currentTarget.value)}
              >
                Deadline (POSIX time)
              </Input>

              {object && deadline && <Button type="submit">Submit Auction Details</Button>}
            </form>
          ) : (
            <>
              <Button
                onClick={createAuction}
                disabled={waitingAuctionTx || !!auctionTxHash}
              >
                {waitingAuctionTx
                  ? "Waiting for Tx..."
                  : "Create Auction"}
              </Button>

              {auctionTxHash && (
                <>
                  <h3 class="mt-4 mb-2">Auction Created</h3>

                  <a
                    class="mb-2"
                    target="_blank"
                    href={`https://preview.cardanoscan.io/transaction/${auctionTxHash}`}
                  >
                    {auctionTxHash}
                  </a>
                </>
              )}

              {auctionTxHash && (
                <Button
                  onClick={startAuction}
                  disabled={waitingAuctionTx || !!auctionTxHash}
                >
                  {waitingAuctionTx
                    ? "Waiting for Tx..."
                    : "Start Auction"}
                </Button>
              )}

              <div class="mt-10 grid grid-cols-1 gap-y-8">
                <Input
                  type="text"
                  name="bidAmount"
                  id="bidAmount"
                  value={bidAmount}
                  onInput={(e) => setBidAmount(e.currentTarget.value)}
                >
                  Bid Amount (ADA)
                </Input>

                <Button
                  onClick={placeBid}
                  disabled={waitingBidTx || !!bidTxHash}
                >
                  {waitingBidTx
                    ? "Waiting for Tx..."
                    : "Place Bid"}
                </Button>

                {bidTxHash && (
                  <>
                    <h3 class="mt-4 mb-2">Bid Placed</h3>

                    <a
                      class="mb-2"
                      target="_blank"
                      href={`https://preview.cardanoscan.io/transaction/${bidTxHash}`}
                    >
                      {bidTxHash}
                    </a>
                  </>
                )}

                <Button
                  onClick={withdrawBid}
                  disabled={waitingWithdrawTx || !!withdrawTxHash}
                >
                  {waitingWithdrawTx
                    ? "Waiting for Tx..."
                    : "Withdraw Bid"}
                </Button>

                {withdrawTxHash && (
                  <>
                    <h3 class="mt-4 mb-2">Bid Withdrawn</h3>

                    <a
                      class="mb-2"
                      target="_blank"
                      href={`https://preview.cardanoscan.io/transaction/${withdrawTxHash}`}
                    >
                      {withdrawTxHash}
                    </a>
                  </>
                )}

                <Button
                  onClick={closeAuction}
                  disabled={waitingCloseTx || !!closeTxHash}
                >
                  {waitingCloseTx
                    ? "Waiting for Tx..."
                    : "Close Auction"}
                </Button>

                {closeTxHash && (
                  <>
                    <h3 class="mt-4 mb-2">Auction Closed</h3>

                    <a
                      class="mb-2"
                      target="_blank"
                      href={`https://preview.cardanoscan.io/transaction/${closeTxHash}`}
                    >
                      {closeTxHash}
                    </a>
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
