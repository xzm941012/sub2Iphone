// This transport is intentionally narrow: confirmation is owned by the dialog.
export async function consumeResetCredit(accountId:number,confirmed:boolean,send:(op:string,payload:any)=>Promise<any>){
 if(!Number.isInteger(accountId)||accountId<=0||confirmed!==true)throw new Error('请先确认重置账户');
 return send('resetOpenAIQuota',{accountId,confirmed:true});
}
