import React from "react";

function Spinner() {
  return <div className=''></div>;
}

const MemoizedSpinner = React.memo(Spinner);
export default MemoizedSpinner;
