"use client";

import { DashboardCard } from "./DashboardCard";
import { styles } from "./TripHomeStyles";

interface MoneyCardProps {
  userBalance: number;
  transfersNeeded: number;
  baseCurrency: string;
  onClick?: () => void;
}

export function MoneyCard({
  userBalance,
  transfersNeeded,
  baseCurrency,
  onClick,
}: MoneyCardProps) {
  // userBalance > 0 means user is owed money, < 0 means user owes
  const owesOrOwed = userBalance < 0;
  const amount = Math.abs(userBalance);
  const formattedAmount = amount.toFixed(2);

  const pillText =
    transfersNeeded > 0
      ? owesOrOwed
        ? "waiting"
        : `${transfersNeeded} incoming`
      : undefined;

  const raised = owesOrOwed && amount > 0;

  return (
    <DashboardCard
      icon="💰"
      label="Money"
      pillText={pillText}
      pillDotColor={owesOrOwed ? "amber" : "green"}
      raised={raised}
      onClick={onClick}
    >
      <div className="min-w-0">
        <div className={`${styles.cardBigSmall} ${owesOrOwed ? styles.cardBigAmber : ""}`}>
          <span className="text-[14px] font-semibold align-top mr-0.5">{baseCurrency}</span>
          {formattedAmount}
        </div>
        <div className={styles.cardMeta}>
          {owesOrOwed
            ? `${transfersNeeded} transfer${transfersNeeded !== 1 ? "s" : ""} needed`
            : transfersNeeded > 0
            ? `${transfersNeeded} payment${transfersNeeded !== 1 ? "s" : ""} coming`
            : "All settled"}
        </div>
      </div>
    </DashboardCard>
  );
}
