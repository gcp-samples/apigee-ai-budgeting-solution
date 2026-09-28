# deploy to cloud run
source .env
go build .
gcloud beta run deploy apigee-ai-budgeting --source . --no-build --base-image=osonly24 --command=./apigee-ai-budgeting --project $GOOGLE_CLOUD_PROJECT --region $GOOGLE_CLOUD_LOCATION --allow-unauthenticated --service-account apigee-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com
