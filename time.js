function setPeriodDate(){
    let date=new Date();
let year=date.getFullYear(); // Returns the current date in UTC/GMT timezone
let month=date.getMonth()+1;
if(month==12){
    year++;
    month=1;}
else{
    month++;
}
month=(String(month).padStart(2, '0'));
return `${year}-${month}-01T00:00:00+03:00`;
}

module.exports = { setPeriodDate };

